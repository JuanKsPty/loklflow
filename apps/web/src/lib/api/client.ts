const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  retried = false,
): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried) {
    const refreshed = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      return apiFetch<T>(path, method, body, true);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(res.status, message, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, 'GET'),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'POST', body),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'PATCH', body),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'PUT', body),
  delete: <T>(path: string) => apiFetch<T>(path, 'DELETE'),
};
