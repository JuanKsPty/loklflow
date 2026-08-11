import type {
  PublicCreateOrderPayload,
  PublicMenu,
  PublicOrderCreated,
  PublicOrderStatus,
} from '@loklflow/types';
import { ApiError, OfflineError } from './client';

/**
 * El cliente HTTP del menú público.
 *
 * **No usa `api` de `client.ts`, y ese es el punto de todo el archivo.** `apiFetch` reintenta cada
 * 401 contra `/auth/refresh` y, si falla, hace `window.location.href = '/login'`: un cliente que
 * escanea un QR acabaría en el formulario de acceso del personal, con un campo de email y un PIN
 * pad, preguntándose qué ha hecho mal. Aquí un 401 es simplemente un pase que caducó, y lo cuenta
 * la pantalla.
 *
 * Tampoco manda cookies. `credentials: 'omit'` es deliberado: si un empleado abre un QR en el mismo
 * navegador donde tiene sesión, su cookie viajaría a estos endpoints sin ninguna necesidad — y el
 * día que alguien añada lógica que mire `request.user` en el módulo público, el comportamiento
 * dependería de quién tenga la pestaña abierta.
 *
 * Se reutilizan `ApiError` y `OfflineError` para que la pantalla pueda distinguir «el servidor dijo
 * que no» de «no hay red», que es la distinción que el resto de la aplicación ya sabe explicar.
 */

import { API_BASE_URL as BASE_URL } from './base-url';

/** La cabecera del pase. Tiene que coincidir con `GUEST_TOKEN_HEADER` del backend. */
export const GUEST_TOKEN_HEADER = 'x-guest-token';

/**
 * Dónde vive el pase en el teléfono.
 *
 * `sessionStorage` y no `localStorage`: cerrar la pestaña termina la sesión del cliente, que es la
 * duración correcta para un teléfono que puede ser compartido y para una capacidad que solo tiene
 * sentido mientras se está comiendo.
 */
const TOKEN_KEY = 'loklflow:guest-token';

export function saveGuestToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function readGuestToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Piezas para leer el pase con `useSyncExternalStore`.
 *
 * Nada externo lo cambia mientras la pantalla vive —lo escribe el propio menú antes de navegar—,
 * así que la suscripción es vacía. Se hace así y no sembrando estado en un efecto porque en el
 * servidor no existe `sessionStorage`, y es exactamente el caso que ese hook resuelve sin un render
 * intermedio con el valor equivocado.
 */
export const guestTokenStore = {
  subscribe: () => () => undefined,
  read: readGuestToken,
  readOnServer: (): string | null => null,
};

export function clearGuestToken(): void {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

async function publicFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; guestToken?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body) headers['Content-Type'] = 'application/json';
  if (init.guestToken) headers[GUEST_TOKEN_HEADER] = init.guestToken;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/public${path}`, {
      method: init.method ?? 'GET',
      headers,
      credentials: 'omit',
      cache: 'no-store',
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new OfflineError('No hay conexión. Comprueba tus datos o el WiFi del local.');
  }

  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(res.status, message, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const publicApi = {
  menu: (qrCode: string) => publicFetch<PublicMenu>(`/menu/${qrCode}`),
  createOrder: (qrCode: string, payload: PublicCreateOrderPayload) =>
    publicFetch<PublicOrderCreated>(`/menu/${qrCode}/orders`, { method: 'POST', body: payload }),
  myOrder: (guestToken: string) =>
    publicFetch<PublicOrderStatus>('/orders/me', { guestToken }),
};
