import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

/**
 * El pase que un cliente recibe al pedir desde el QR, para poder seguir su pedido.
 *
 * **Por qué no basta con el id del pedido.** La alternativa evidente —`GET /public/orders/:id`
 * con el uuid de la orden— no falla por adivinable (un uuid v4 no lo es), falla por acoplar
 * identidad y capacidad: ese uuid es la clave primaria que aparece en cada evento de socket, en
 * las URLs de `/recibo/:id` y que **el propio dispositivo elige** para la cola sin conexión. Una
 * filtración en cualquiera de esos sitios se convertiría en una capacidad de lectura permanente,
 * sin caducidad y sin forma de revocarla.
 *
 * Con un token firmado, la capacidad caduca sola en cuatro horas —una comida— y no coincide con
 * ningún identificador que el sistema use para otra cosa.
 */

export interface GuestTokenPayload {
  /** Discriminante. Es lo que impide que esto pase por una sesión de personal. */
  typ: 'guest_order';
  orderId: string;
  tableId: string;
}

/** Cabecera por la que viaja. No la ruta: ver `deriveGuestSecret`. */
export const GUEST_TOKEN_HEADER = 'x-guest-token';

/** Una comida. Coincide con `jwt.pinExpiresIn`, que cubre un turno. */
export const GUEST_TOKEN_TTL = '4h';

/**
 * Deriva el secreto del token de invitado a partir del de las sesiones.
 *
 * **No hay una tercera variable de entorno**, y es deliberado: `jwt.config.ts` ya lanza al
 * arrancar si falta `JWT_SECRET` o si sigue con el valor de ejemplo, y añadir
 * `GUEST_TOKEN_SECRET` sería una forma más de que un despliegue no arranque —o peor, que arranque
 * con un secreto flojo— a cambio de nada. Derivarlo por HMAC con una etiqueta da un secreto
 * independiente del de las sesiones: quien tenga uno no puede firmar tokens del otro.
 *
 * El `:v1` de la etiqueta es la palanca de rotación: cambiarlo invalida todos los pases vivos sin
 * tocar ninguna sesión del personal.
 */
export function deriveGuestSecret(jwtSecret: string): string {
  return createHmac('sha256', jwtSecret).update('loklflow:guest-order:v1').digest('base64');
}

export function signGuestToken(
  jwt: JwtService,
  secret: string,
  payload: GuestTokenPayload,
): string {
  // Sin `sub`, sin `permissions` y sin `roleId`: no es una sesión y no debe parecerlo.
  return jwt.sign(payload, { secret, expiresIn: GUEST_TOKEN_TTL });
}

/**
 * Verifica el pase. Lanza 401 si no vale, como cualquier credencial.
 *
 * Comprueba `typ` explícitamente además de la firma. Con el secreto derivado esto ya es
 * redundante —un token de sesión no verifica contra este secreto—, pero es la clase de
 * comprobación que cuesta una línea y evita que una refactorización futura que unifique secretos
 * abra un agujero en silencio.
 */
export function verifyGuestToken(
  jwt: JwtService,
  secret: string,
  token: string | undefined,
): GuestTokenPayload {
  if (!token) throw new UnauthorizedException('Falta el pase del pedido');

  let payload: unknown;
  try {
    payload = jwt.verify(token, { secret });
  } catch {
    throw new UnauthorizedException('El pase del pedido no vale o ha caducado');
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    (payload as { typ?: unknown }).typ !== 'guest_order' ||
    typeof (payload as { orderId?: unknown }).orderId !== 'string' ||
    typeof (payload as { tableId?: unknown }).tableId !== 'string'
  ) {
    throw new UnauthorizedException('El pase del pedido no vale');
  }

  const { typ, orderId, tableId } = payload as GuestTokenPayload;
  return { typ, orderId, tableId };
}
