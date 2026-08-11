import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { durationToMs } from './duration';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { LoginAttemptsService } from './login-attempts.service';
import { TokenVersionCache } from '../token-version/token-version.cache';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';

/**
 * Cuántos tokens de refresco vivos se conservan por usuario.
 *
 * Cinco cubre el caso legítimo —la tablet del salón, la de caja y el teléfono, con margen— y acota
 * cuántas sesiones reactivables deja atrás alguien que entra y sale todo el día.
 */
const MAX_LIVE_REFRESH_TOKENS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly audit: AuditService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly attempts: LoginAttemptsService,
    private readonly tokenVersions: TokenVersionCache,
  ) {}

  async login(dto: LoginDto, res: Response, ip?: string) {
    const attemptKey = `email:${dto.email.toLowerCase()}`;
    await this.assertNotLocked(attemptKey, { email: dto.email }, ip);

    // Los login se auditan aquí y no con @Audit() porque el handler es @Public()
    // (no hay request.user que atribuir) y los fallos salen como excepción, que un
    // interceptor no llega a ver.
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      await this.auditLoginFailure({ email: dto.email }, 'credenciales inválidas', ip);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.password) {
      await this.auditLoginFailure(
        { email: dto.email, userId: user.id },
        'sin contraseña configurada',
        ip,
      );
      throw new UnauthorizedException('Password login not configured for this user');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.auditLoginFailure(
        { email: dto.email, userId: user.id },
        'credenciales inválidas',
        ip,
      );
      await this.registerFailure(attemptKey, { email: dto.email, userId: user.id }, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.attempts.registerSuccess(attemptKey);
    await this.auditLoginSuccess(user.id, user.name, 'email', ip);
    return this.issueTokens(user.id, user.name, user.email, user.role.id, user.role.name, 'email', res);
  }

  async pinLogin(dto: PinLoginDto, res: Response, ip?: string) {
    const attemptKey = `pin:${dto.userId}`;
    await this.assertNotLocked(attemptKey, { userId: dto.userId }, ip);

    const user = await this.usersService.findByIdWithCredentials(dto.userId);
    if (!user || !user.isActive) {
      await this.auditLoginFailure({ userId: dto.userId }, 'usuario inexistente o inactivo', ip);
      throw new UnauthorizedException('User not found or inactive');
    }
    if (!user.pin) {
      await this.auditLoginFailure({ userId: dto.userId }, 'sin PIN configurado', ip);
      throw new UnauthorizedException('PIN login not configured for this user');
    }

    const valid = await bcrypt.compare(dto.pin, user.pin);
    if (!valid) {
      await this.auditLoginFailure({ userId: dto.userId }, 'PIN incorrecto', ip);
      await this.registerFailure(attemptKey, { userId: dto.userId }, ip);
      throw new UnauthorizedException('Invalid PIN');
    }

    this.attempts.registerSuccess(attemptKey);
    await this.auditLoginSuccess(user.id, user.name, 'pin', ip);
    return this.issueTokens(user.id, user.name, user.email, user.role.id, user.role.name, 'pin', res, true);
  }

  /**
   * `loginMethod` viene del payload del propio token de refresco, que lo lleva porque
   * `issueTokens` firma el mismo payload para los dos tokens.
   *
   * Antes estaba fijado a `'email'`, así que el primer refresco de una sesión por PIN la
   * degradaba: el token pasaba de cuatro horas a quince minutos y la bitácora empezaba a
   * registrar `loginMethod: 'email'` para alguien que había entrado con PIN.
   */
  async refresh(
    userId: string,
    refreshToken: string,
    res: Response,
    loginMethod: 'email' | 'pin' = 'email',
  ) {
    const stored = await this.refreshTokenRepo.findOne({
      where: { token: refreshToken, isRevoked: false },
      relations: { user: { role: true } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (stored.user.id !== userId) throw new UnauthorizedException();

    stored.isRevoked = true;
    await this.refreshTokenRepo.save(stored);

    const user = stored.user;
    return this.issueTokens(
      user.id,
      user.name,
      user.email,
      user.role.id,
      user.role.name,
      loginMethod,
      res,
      loginMethod === 'pin',
    );
  }

  async logout(userId: string, res: Response, ip?: string) {
    await this.refreshTokenRepo.update({ user: { id: userId } }, { isRevoked: true });
    this.clearCookies(res);
    // Se audita aquí y no con @Audit() porque el handler responde 204 sin cuerpo.
    await this.audit.createLog({
      userId,
      action: 'auth.logout',
      entityType: 'session',
      entityId: userId,
      ipAddress: ip,
    });
  }

  /** Nunca recibe la contraseña ni el PIN: solo el identificador intentado y el motivo. */
  private auditLoginFailure(
    attempted: { email?: string; userId?: string },
    reason: string,
    ip?: string,
  ) {
    return this.audit.createLog({
      userId: attempted.userId,
      action: 'auth.login_failed',
      entityType: 'session',
      entityId: attempted.userId,
      newValue: { ...attempted, reason },
      ipAddress: ip,
    });
  }

  private auditLoginSuccess(
    userId: string,
    name: string,
    method: 'email' | 'pin',
    ip?: string,
  ) {
    return this.audit.createLog({
      userId,
      userName: name,
      action: 'auth.login',
      entityType: 'session',
      entityId: userId,
      newValue: { loginMethod: method },
      ipAddress: ip,
    });
  }

  async me(payload: JwtPayload) {
    const user = await this.usersService.findOne(payload.sub);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.role.id,
      roleName: user.role.name,
      permissions: payload.permissions,
      isActive: user.isActive,
      loginMethod: payload.loginMethod,
    };
  }

  private async issueTokens(
    userId: string,
    name: string,
    email: string | null,
    roleId: string,
    roleName: string,
    loginMethod: 'email' | 'pin',
    res: Response,
    pinOnly = false,
  ) {
    const permissions = await this.rolesService.getPermissionsForRole(roleId);
    const role = await this.rolesService.findOne(roleId);
    // La versión de sesión viaja firmada: es lo que permite invalidar todas las sesiones de un
    // usuario subiendo un contador, sin consultar la base en cada petición.
    const tv = (await this.tokenVersions.versionOf(userId)) ?? 0;

    const payload: JwtPayload = {
      sub: userId,
      tv,
      name,
      email,
      roleId,
      roleName,
      permissions,
      loginMethod,
      maxDiscountPercentage: Number(role.maxDiscountPercentage) || 0,
    };

    const accessExpiresIn = pinOnly
      ? (this.config.get<string>('jwt.pinExpiresIn') ?? '4h')
      : (this.config.get<string>('jwt.expiresIn') ?? '15m');

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
    });

    const cookieOptions = this.cookieOptions();

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: durationToMs(accessExpiresIn),
    });

    // El refresco se emite SIEMPRE, también en las sesiones por PIN. Antes iba dentro de un
    // `if (!pinOnly)`, así que el token de PIN duraba cuatro horas exactas sin forma de
    // renovarse: a mitad de turno el operario quedaba fuera y aterrizaba en el formulario de
    // email, donde no tiene credenciales porque solo tiene PIN. Un turno dura más de cuatro
    // horas, así que se disparaba en operación normal, no solo en caídas.
    const refreshExpiresIn = pinOnly
      ? this.config.get<string>('jwt.pinRefreshExpiresIn')!
      : this.config.get<string>('jwt.refreshExpiresIn')!;
    const refreshMs = durationToMs(refreshExpiresIn);

    // `jti` único por emisión. Sin él, dos inicios de sesión del mismo usuario dentro del
    // mismo segundo producen un JWT byte a byte idéntico —el payload es determinista y el
    // `iat` va en segundos—, y `refresh_tokens.token` es único: la segunda petición moría con
    // un 500. Con las sesiones por PIN emitiendo refresco esto pasa a ser alcanzable a diario,
    // porque el personal entra por PIN todo el tiempo.
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    // Derivado de la misma duración que la firma. Antes eran siete días escritos a mano en
    // dos sitios, así que cambiar JWT_REFRESH_EXPIRES_IN dejaba el JWT, la cookie y la fila
    // de `refresh_tokens` con tres caducidades distintas.
    const rt = this.refreshTokenRepo.create({
      token: refreshToken,
      user: { id: userId },
      expiresAt: new Date(Date.now() + refreshMs),
    });
    await this.refreshTokenRepo.save(rt);
    // **Después** de guardar el nuevo y excluyéndolo, o el login se invalidaría a sí mismo.
    await this.pruneRefreshTokens(userId, rt.id);

    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: refreshMs,
    });

    return { id: userId, name, email, roleId, roleName, permissions, loginMethod };
  }

  /**
   * Los atributos con los que se ponen **y se borran** las cookies de sesión.
   *
   * Extraído a un método porque el `clearCookie` los omitía: llevaba solo `path`. Varios
   * navegadores cotejan el conjunto de atributos al invalidar una cookie, así que
   * `httpOnly`/`secure`/`sameSite` distintos pueden hacer que **la cookie sobreviva al cierre de
   * sesión**. Funcionaba en la práctica por casualidad; con un método compartido no depende de
   * que dos sitios se mantengan iguales.
   */
  /**
   * Rechaza si la clave está bloqueada, **con el mismo error que unas credenciales incorrectas**.
   *
   * Ni 423 ni 429 ni un mensaje distinto: cualquiera de las tres cosas sería un oráculo gratis
   * —«esta cuenta existe y alguien la está atacando»— y además le diría a quien prueba cuándo
   * volver. Desde fuera, una cuenta bloqueada y un PIN mal se ven exactamente igual.
   *
   * El coste asumido es que un empleado que se equivoca cinco veces ve «PIN incorrecto» durante un
   * minuto aunque acierte. Es un minuto, y la alternativa es contarle a un atacante cómo va.
   */
  private async assertNotLocked(
    key: string,
    subject: { email?: string; userId?: string },
    ip?: string,
  ): Promise<void> {
    if (!this.attempts.isLocked(key)) return;
    await this.auditLoginFailure(subject, 'bloqueado por intentos fallidos', ip);
    // **El mismo mensaje exacto que daría la credencial incorrecta de esa vía**, no uno genérico:
    // `pinLogin` responde «Invalid PIN» y `login` «Invalid credentials», así que un mensaje único
    // para los dos delataría el bloqueo en la ruta del PIN — que es justo la que se ataca.
    throw new UnauthorizedException(subject.email ? 'Invalid credentials' : 'Invalid PIN');
  }

  /** Anota el fallo y deja constancia en la bitácora cuando el bloqueo se activa. */
  private async registerFailure(
    key: string,
    subject: { email?: string; userId?: string },
    ip?: string,
  ): Promise<void> {
    if (!this.attempts.registerFailure(key)) return;
    // Se audita **el bloqueo**, no cada fallo: los fallos ya se registran uno a uno, y lo que el
    // dueño quiere ver en `/admin/audit` es «alguien estuvo probando con la cuenta de Ana».
    await this.audit.createLog({
      userId: subject.userId,
      action: 'auth.login_locked',
      entityType: 'session',
      entityId: subject.userId,
      newValue: { ...(subject.email ? { email: subject.email } : {}) },
      ipAddress: ip,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('app.nodeEnv') === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
  }

  private clearCookies(res: Response) {
    res.clearCookie('access_token', this.cookieOptions());
    res.clearCookie('refresh_token', this.cookieOptions());
  }

  /**
   * Deja como mucho `MAX_LIVE_REFRESH_TOKENS` vivos por usuario y borra lo caducado.
   *
   * `refresh_tokens` crecía sin tope: cada inicio de sesión inserta una fila y solo el `logout` las
   * revoca en bloque, así que un bucle de login —o simplemente meses de operación normal con una
   * tablet que entra por PIN varias veces al día— llena la tabla de credenciales vivas que nadie
   * va a usar. Cada una es una sesión que un robo de base de datos podría reactivar.
   *
   * Cinco cubre de sobra el caso legítimo: el mismo empleado en la tablet del salón, la de caja y
   * su teléfono, con margen. Es best-effort: si la poda falla, el login **no** puede fallar con
   * ella.
   */
  private async pruneRefreshTokens(userId: string, keepId: string): Promise<void> {
    try {
      // Lo caducado y lo revocado no vale para nada: fuera de la tabla, no solo marcado.
      await this.refreshTokenRepo
        .createQueryBuilder()
        .delete()
        .where('user_id = :userId', { userId })
        .andWhere('(is_revoked = true OR expires_at < now())')
        .execute();

      const live = await this.refreshTokenRepo.find({
        where: { user: { id: userId }, isRevoked: false },
        order: { createdAt: 'DESC' },
      });

      const stale = live.filter((t) => t.id !== keepId).slice(MAX_LIVE_REFRESH_TOKENS - 1);
      if (stale.length > 0) {
        await this.refreshTokenRepo.remove(stale);
      }
    } catch {
      // Un fallo limpiando no puede impedir que alguien entre a trabajar.
    }
  }
}
