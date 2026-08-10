import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { TokenVersionCache } from '../../token-version/token-version.cache';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly tokenVersions: TokenVersionCache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['access_token'] as string | null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException();
    /**
     * Un pase de invitado —el que se emite al pedir desde el QR— nunca es una sesión.
     *
     * Es redundante y está a propósito: el pase se firma con un secreto **derivado** de este, así
     * que no verificaría aquí ni aunque alguien lo pusiera en la cookie `access_token`; y además
     * no lleva `sub`, que la línea de arriba ya exige. Se comprueba igualmente porque cuesta una
     * línea y evita que una refactorización futura que unifique secretos abra un agujero sin que
     * nada falle de forma visible.
     */
    if ('typ' in payload) throw new UnauthorizedException();

    /**
     * La sesión deja de valer si su versión no es la actual.
     *
     * Es lo que hace efectivo desactivar a un empleado, cambiarle el rol o quitarle un permiso:
     * antes nada de eso surtía efecto hasta que el token caducara —cuatro horas para una sesión por
     * PIN—, así que alguien despedido conservaba acceso operativo media jornada.
     *
     * Dos formas de **no** rechazar, las dos deliberadas: un token sin `tv` es anterior a esta
     * función y se trata como versión 0 (la de todos tras la migración), y una versión `null`
     * significa que no se pudo consultar y se acepta. Esto es una caja registradora: un parpadeo de
     * Postgres no puede echar al salón entero a mitad de servicio.
     */
    const current = await this.tokenVersions.versionOf(payload.sub);
    if (current !== null && (payload.tv ?? 0) !== current) {
      throw new UnauthorizedException('Sesión revocada');
    }

    return payload;
  }
}
