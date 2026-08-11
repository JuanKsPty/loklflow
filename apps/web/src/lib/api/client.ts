import { announceReachability } from './reachability';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
    /**
     * El id que el servidor asignó a esta petición, leído de la cabecera `x-request-id`.
     *
     * Es lo que convierte «me salió un error» en algo investigable: con él se localiza en el
     * log del servidor la línea exacta, con su pila. Llega hasta aquí porque `main.ts` lo
     * declara en `exposedHeaders` de CORS; sin eso el navegador no deja leerlo y la cabecera
     * sería código muerto.
     */
    public readonly requestId?: string,
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
    const response = await fetch(input, init);
    // Contestó algo, aunque sea un 500: el servidor está ahí. Se anuncia desde aquí para que
    // **cualquier** petición mueva el indicador de conexión, y no solo las que pasan por la
    // cola: un cobro no se difiere nunca, así que antes un cobro fallido no movía nada y el
    // cajero seguía viendo «Al día» mientras no llegaba una sola petición.
    announceReachability('reached');
    return response;
  } catch {
    announceReachability('unreachable');
    throw new OfflineError();
  }
}

function requestIdOf(res: Response): string | undefined {
  return res.headers.get('x-request-id') ?? undefined;
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

/**
 * Rutas donde un 401 significa «esas credenciales no valen», no «tu sesión caducó».
 *
 * Sin esta distinción, **teclear mal el PIN echaba al operario a `/login`**: el 401 de
 * `/auth/pin` disparaba el refresco, el refresco daba otro 401 —no hay sesión que refrescar—, y
 * `bounceToLogin()` lo mandaba al formulario de correo, donde un mesero no tiene credenciales. Un
 * dedo torpe se convertía en «llama al encargado».
 *
 * De paso deja de haber una petición inútil a `/auth/refresh` en cada intento fallido, que era la
 * que alimentaba el contador de bloqueo desde el lado equivocado.
 */
function isCredentialCheck(path: string): boolean {
  return path === '/auth/login' || path === '/auth/pin';
}

async function apiFetch<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  retried = false,
  /**
   * Si al fallar el refresco hay que expulsar al login. Verdadero para todo lo que nace de un
   * toque del operario; **falso** para lo que reenvía la cola sin conexión — ver `replayApi`.
   */
  bounce = true,
): Promise<T> {
  const res = await request(`${BASE_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried && !isCredentialCheck(path)) {
    const refreshed = await request(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      // Se reenvía el mismo cuerpo, con la misma clave de idempotencia si la lleva, así que
      // un reintento nunca duplica una orden ni un cobro.
      return apiFetch<T>(path, method, body, true, bounce);
    }
    if (!bounce) throw new ApiError(401, 'Sesión caducada', undefined, requestIdOf(res));
    bounceToLogin();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(res.status, message, data, requestIdOf(res));
  }

  if (res.status === 204) return undefined as T;
  // Un 200 con cuerpo vacío es `null`, no un error de sintaxis: `GET /shifts/current` responde
  // así cuando el cajero no tiene turno abierto, que es el estado normal al llegar. Con
  // `res.json()` a secas eso reventaba con «Unexpected end of JSON input» y la caja lo trataba
  // como una caída de la API.
  const text = await res.text();
  return (text.trim() === '' ? null : JSON.parse(text)) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, 'GET'),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'POST', body),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'PATCH', body),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'PUT', body),
  delete: <T>(path: string) => apiFetch<T>(path, 'DELETE'),
};

/**
 * El mismo cliente, pero **sin expulsar al login**. Lo usa la cola sin conexión al reenviar.
 *
 * `bounceToLogin()` hace `window.location.href = '/login'`, y llamarlo desde dentro del bucle
 * de drenado tira la pantalla a media sincronización: el operario ve desaparecer su cuenta y
 * lo que quedaba en la cola no se envía ni deja rastro de por qué. Aquí el 401 se convierte
 * en un `ApiError` normal, que la cola sabe clasificar: no es un fallo de la operación, es un
 * problema de sesión, así que detiene el drenado y lo dice en el indicador en vez de
 * mandar toda la cola a la bandeja de fallos.
 */
export const replayApi = {
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'POST', body, false, false),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'PATCH', body, false, false),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, 'PUT', body, false, false),
  delete: <T>(path: string) => apiFetch<T>(path, 'DELETE', undefined, false, false),
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
    throw new ApiError(
      res.status,
      `No se pudo descargar el archivo (${res.status})`,
      undefined,
      requestIdOf(res),
    );
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
