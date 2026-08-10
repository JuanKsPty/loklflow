import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['access_token'] as string | null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  validate(payload: JwtPayload) {
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
    return payload;
  }
}
