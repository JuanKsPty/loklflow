import { cookies } from 'next/headers';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ServerApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function serverFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: token ? { Cookie: `access_token=${token}` } : {},
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new ServerApiError(res.status, `API error ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}
