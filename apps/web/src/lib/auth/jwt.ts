import { jwtVerify } from 'jose';
import type { JwtPayload } from '@loklflow/types';

/**
 * Única fuente del secreto y de la verificación del JWT en el frontend.
 * Antes esto estaba triplicado (proxy, layout del dashboard y server-user), con un
 * fallback al secreto de ejemplo en cada copia: cualquier corrección de seguridad
 * había que aplicarla en tres sitios y el fallback anulaba la verificación.
 *
 * Sin default a propósito: si falta JWT_SECRET preferimos rechazar toda sesión
 * antes que validar tokens con un secreto público.
 */
function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.startsWith('change-this')) return null;
  return new TextEncoder().encode(secret);
}

/** Verifica el token y devuelve el payload, o null si es inválido, expirado o falta el secreto. */
export async function verifyToken(token: string | undefined): Promise<JwtPayload | null> {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) {
    console.error('[auth] JWT_SECRET no está configurado: se rechaza la sesión.');
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
