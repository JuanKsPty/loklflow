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

/**
 * No se pudo hablar con el servidor: WiFi caído, servidor apagado, DNS que no resuelve.
 *
 * Se distingue de `ApiError` porque no es lo mismo que el servidor conteste que algo está mal
 * a que no conteste. Antes las dos cosas salían igual —un `TypeError` en bruto del `fetch`— y
 * la interfaz solo podía enseñar «Error». Con este tipo, quien llama puede decir «sin
 * conexión» y, más adelante, encolar la operación en lugar de perderla.
 */
export class OfflineError extends Error {
  constructor(message = 'No hay conexión con el servidor') {
    super(message);
    this.name = 'OfflineError';
  }
}

/**
 * Envoltorio de `fetch` que convierte el rechazo de red en `OfflineError`.
 *
 * `fetch` solo rechaza cuando la petición no llega a completarse; cualquier respuesta del
 * servidor, incluido un 500, resuelve normalmente. Por eso este es el único punto del cliente
 * que necesita distinguirlo.
 */
async function request(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new OfflineError();
  }
}

/** Redirige al login, salvo que el problema sea que no hay red. */
function bounceToLogin(): never {
  // Sin conexión no tiene sentido expulsar al operario: el login tampoco cargaría y encima
  // pierde de vista su propia cuenta. Se le devuelve un error que la interfaz sabe explicar.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OfflineError('Sesión sin verificar: no hay conexión con el servidor');
  }
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
  throw new ApiError(401, 'Session expired');
}

async function apiFetch<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  retried = false,
): Promise<T> {
  const res = await request(`${BASE_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried) {
    const refreshed = await request(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      // Se reenvía el mismo cuerpo, con la misma clave de idempotencia si la lleva, así que
      // un reintento nunca duplica una orden ni un cobro.
      return apiFetch<T>(path, method, body, true);
    }
    bounceToLogin();
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
  const attempt = async (retried = false): Promise<Response> => {
    const res = await request(`${BASE_URL}/api${path}`, { credentials: 'include' });
    if (res.status === 401 && !retried) {
      const refreshed = await request(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshed.ok) return attempt(true);
      bounceToLogin();
    }
    return res;
  };

  const res = await attempt();
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
