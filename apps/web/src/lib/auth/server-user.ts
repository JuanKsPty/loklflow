import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { JwtPayload } from '@loklflow/types';

/** Decodifica el JWT de la cookie en el servidor. Mismo mecanismo que el layout del dashboard. */
export async function getServerUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'change-this-secret-in-production',
    );
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getServerUser();
  return user?.permissions?.includes(permission) ?? false;
}
