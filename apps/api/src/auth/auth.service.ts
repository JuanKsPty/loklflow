import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';

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
  ) {}

  async login(dto: LoginDto, res: Response, ip?: string) {
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
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auditLoginSuccess(user.id, user.name, 'email', ip);
    return this.issueTokens(user.id, user.name, user.email, user.role.id, user.role.name, 'email', res);
  }

  async pinLogin(dto: PinLoginDto, res: Response, ip?: string) {
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
      throw new UnauthorizedException('Invalid PIN');
    }

    await this.auditLoginSuccess(user.id, user.name, 'pin', ip);
    return this.issueTokens(user.id, user.name, user.email, user.role.id, user.role.name, 'pin', res, true);
  }

  async refresh(userId: string, refreshToken: string, res: Response) {
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
    return this.issueTokens(user.id, user.name, user.email, user.role.id, user.role.name, 'email', res);
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

    const payload: JwtPayload = { sub: userId, name, email, roleId, roleName, permissions, loginMethod };

    const accessExpiresIn = pinOnly
      ? (this.config.get<string>('jwt.pinExpiresIn') ?? '4h')
      : (this.config.get<string>('jwt.expiresIn') ?? '15m');

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
    });

    const cookieOptions = {
      httpOnly: true,
      secure: this.config.get<string>('app.nodeEnv') === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: pinOnly ? 4 * 60 * 60 * 1000 : 15 * 60 * 1000,
    });

    if (!pinOnly) {
      const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn')!;
      const refreshToken = this.jwtService.sign(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const rt = this.refreshTokenRepo.create({
        token: refreshToken,
        user: { id: userId },
        expiresAt,
      });
      await this.refreshTokenRepo.save(rt);

      res.cookie('refresh_token', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return { id: userId, name, email, roleId, roleName, permissions, loginMethod };
  }

  private clearCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }
}
