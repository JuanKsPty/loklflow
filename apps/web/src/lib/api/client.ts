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

/**
 * Descarga un archivo del API y lo guarda en el disco del usuario.
 *
 * No pasa por `apiFetch` porque ese siempre termina en `res.json()`. Y no puede ser un
 * `<a href>` directo: la sesión es una cookie httpOnly y un enlace no atravesaría la
 * lógica de refresh del 401, así que un token caducado descargaría un error en lugar
 * del archivo.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const request = (retried = false): Promise<Response> =>
    fetch(`${BASE_URL}/api${path}`, { credentials: 'include' }).then(async (res) => {
      if (res.status === 401 && !retried) {
        const refreshed = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (refreshed.ok) return request(true);
        if (typeof window !== 'undefined') window.location.href = '/login';
        throw new ApiError(401, 'Session expired');
      }
      return res;
    });

  const res = await request();
  if (!res.ok) {
    throw new ApiError(res.status, `No se pudo descargar el archivo (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    // Sin esto el blob se queda en memoria mientras viva la pestaña.
    URL.revokeObjectURL(url);
  }
}
