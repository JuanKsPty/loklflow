/**
 * De dónde cuelga la API, en un solo sitio.
 *
 * Existía **cuatro veces** con el mismo literal —`client.ts`, `public.api.ts`, `server-client.ts`
 * y, por su cuenta, el `connect-src` del CSP—, y ese último se calculaba a partir de la variable
 * **sin el valor por defecto**. Mientras el CSP fue de informe daba igual; al obligarlo, un build
 * sin `NEXT_PUBLIC_API_URL` producía una aplicación donde el cliente llama a `localhost:3001` y el
 * navegador bloquea todas las llamadas por política, sin un solo error de red: solo una línea en
 * la consola.
 *
 * Lo encontró el CI, que construye sin `.env`. En local no se veía porque el `.env` de la raíz
 * define la variable — que es exactamente por lo que un valor por defecto duplicado es peligroso:
 * el camino que falla es el que nadie recorre a diario.
 */

/** El puerto en el que corre la API en desarrollo. */
export const DEFAULT_API_URL = 'http://localhost:3001';

/**
 * Se lee de `process.env` en ámbito de módulo a propósito: `NEXT_PUBLIC_*` se sustituye en el
 * build, así que esto acaba siendo una constante en el bundle.
 */
export const API_BASE_URL = apiUrlOr(DEFAULT_API_URL);

/**
 * Una cadena vacía cuenta como **ausente**, no como una URL válida.
 *
 * `??` solo atrapa `undefined` y `null`, así que un `NEXT_PUBLIC_API_URL=` en un `.env` —una
 * línea que parece inofensiva— dejaba la base en `''` y todas las llamadas salían contra rutas
 * relativas del web, que no existen.
 */
export function apiUrlOr(fallback: string): string {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  return value ? value : fallback;
}
