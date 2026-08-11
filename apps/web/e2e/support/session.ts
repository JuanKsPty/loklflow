import { SignJWT } from 'jose';
import type { BrowserContext } from '@playwright/test';

/**
 * Una sesión válida sin levantar la API.
 *
 * Es lo que abre las pantallas operativas en estas pruebas. `proxy.ts` y `getServerUser()`
 * verifican la cookie con `JWT_SECRET` **en el servidor de Next**, así que basta con firmar un
 * token con el mismo secreto que `playwright.config.ts` ya le inyecta: no hace falta Postgres,
 * ni migraciones, ni seed, ni el contenedor de la API.
 *
 * No es un atajo sospechoso: el token que se firma aquí pasa exactamente la misma verificación
 * que uno emitido por `/api/auth/login`. Lo que no se prueba con esto es el flujo de login en
 * sí, que tiene sus propias pruebas en el bloque de e2e completo.
 */

const SECRET = process.env.JWT_SECRET ?? 'clave-solo-para-e2e-que-no-vale-en-ningun-sitio';

export interface FakeUser {
  sub?: string;
  email?: string;
  roleName?: string;
  permissions?: string[];
  maxDiscountPercentage?: number;
}

/** Todos los permisos que tocan las superficies operativas. */
export const OPERATIONAL_PERMISSIONS = [
  'orders:create',
  'orders:read',
  'orders:update',
  'tables:read',
  'tables:update',
  'menu:read',
  'pos:read',
  'pos:create',
];

export async function signSession(user: FakeUser = {}): Promise<string> {
  return new SignJWT({
    sub: user.sub ?? '00000000-0000-4000-8000-000000000001',
    name: 'Mesero E2E',
    email: user.email ?? 'mesero@loklflow.com',
    roleId: '00000000-0000-4000-8000-0000000000ff',
    roleName: user.roleName ?? 'Mesero',
    permissions: user.permissions ?? OPERATIONAL_PERMISSIONS,
    maxDiscountPercentage: user.maxDiscountPercentage ?? 0,
    loginMethod: 'pin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(SECRET));
}

export async function loginAs(
  context: BrowserContext,
  baseURL: string,
  user: FakeUser = {},
): Promise<void> {
  const token = await signSession(user);
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    { name: 'access_token', value: token, domain: hostname, path: '/', httpOnly: true },
  ]);
}
