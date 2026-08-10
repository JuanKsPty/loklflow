import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import {
  deriveGuestSecret,
  signGuestToken,
  verifyGuestToken,
  type GuestTokenPayload,
} from './guest-token';

const JWT_SECRET = 'el-secreto-de-las-sesiones-que-no-se-comparte';
const jwt = new JwtService();

const payload: GuestTokenPayload = {
  typ: 'guest_order',
  orderId: '11111111-1111-4111-8111-111111111111',
  tableId: '22222222-2222-4222-8222-222222222222',
};

describe('pase del pedido de un cliente', () => {
  const secret = deriveGuestSecret(JWT_SECRET);

  it('ida y vuelta: se firma y se verifica', () => {
    const token = signGuestToken(jwt, secret, payload);

    expect(verifyGuestToken(jwt, secret, token)).toEqual(payload);
  });

  describe('el secreto derivado', () => {
    it('es estable para el mismo secreto de sesiones', () => {
      expect(deriveGuestSecret(JWT_SECRET)).toBe(deriveGuestSecret(JWT_SECRET));
    });

    it('cambia si cambia el secreto de sesiones', () => {
      expect(deriveGuestSecret(JWT_SECRET)).not.toBe(deriveGuestSecret('otro-secreto'));
    });

    /**
     * La propiedad que justifica derivarlo en vez de reutilizar `JWT_SECRET` tal cual: quien
     * pueda firmar un pase de invitado **no** puede firmar una sesión de personal.
     */
    it('no es el secreto de las sesiones', () => {
      expect(secret).not.toBe(JWT_SECRET);
    });

    it('un pase no verifica contra el secreto de las sesiones', () => {
      const token = signGuestToken(jwt, secret, payload);

      expect(() => verifyGuestToken(jwt, JWT_SECRET, token)).toThrow(UnauthorizedException);
    });

    it('una sesión de personal no verifica como pase', () => {
      const sesion = jwt.sign({ sub: 'un-usuario', permissions: ['orders:read'] }, {
        secret: JWT_SECRET,
      });

      expect(() => verifyGuestToken(jwt, secret, sesion)).toThrow(UnauthorizedException);
    });
  });

  describe('lo que rechaza', () => {
    it('sin token', () => {
      expect(() => verifyGuestToken(jwt, secret, undefined)).toThrow(UnauthorizedException);
      expect(() => verifyGuestToken(jwt, secret, '')).toThrow(UnauthorizedException);
    });

    it('un token que no es un JWT', () => {
      expect(() => verifyGuestToken(jwt, secret, 'no-soy-un-token')).toThrow(
        UnauthorizedException,
      );
    });

    it('un token caducado', () => {
      const caducado = jwt.sign(payload, { secret, expiresIn: '-1s' });

      expect(() => verifyGuestToken(jwt, secret, caducado)).toThrow(UnauthorizedException);
    });

    /**
     * `typ` se comprueba aparte de la firma. Con el secreto derivado ya es redundante, pero es la
     * comprobación que cuesta una línea y evita que una refactorización que unifique secretos
     * abra un agujero sin que nada falle.
     */
    it('un token bien firmado pero sin el discriminante', () => {
      const sinTyp = jwt.sign({ orderId: payload.orderId, tableId: payload.tableId }, { secret });

      expect(() => verifyGuestToken(jwt, secret, sinTyp)).toThrow(UnauthorizedException);
    });

    it('un token con el discriminante equivocado', () => {
      const otroTipo = jwt.sign({ ...payload, typ: 'session' }, { secret });

      expect(() => verifyGuestToken(jwt, secret, otroTipo)).toThrow(UnauthorizedException);
    });

    it('un token sin los identificadores que necesita', () => {
      const incompleto = jwt.sign({ typ: 'guest_order', orderId: payload.orderId }, { secret });

      expect(() => verifyGuestToken(jwt, secret, incompleto)).toThrow(UnauthorizedException);
    });
  });

  /**
   * Un pase no lleva `sub`, y `JwtStrategy.validate` lanza cuando falta. Así que aunque alguien
   * lo colocara en la cookie `access_token`, no se convertiría en una sesión: la defensa está en
   * los dos lados, y ninguna depende de que el otro se acuerde.
   */
  it('no lleva sub, permissions ni roleId', () => {
    const token = signGuestToken(jwt, secret, payload);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.sub).toBeUndefined();
    expect(decoded.permissions).toBeUndefined();
    expect(decoded.roleId).toBeUndefined();
  });
});
