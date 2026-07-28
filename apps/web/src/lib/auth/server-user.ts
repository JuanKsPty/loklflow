import { cookies } from 'next/headers';
import type { JwtPayload } from '@loklflow/types';
import { verifyToken } from './jwt';

/** Decodifica el JWT de la cookie en el servidor. */
export async function getServerUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get('access_token')?.value);
}

export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getServerUser();
  return user?.permissions?.includes(permission) ?? false;
}
