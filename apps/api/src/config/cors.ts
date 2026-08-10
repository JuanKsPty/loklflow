/**
 * Los orígenes que pueden hablar con la API, validados **al arrancar**.
 *
 * Función pura y compartida, no un `process.env.CORS_ORIGINS?.split(',')` en cada sitio. Estaba
 * duplicado en `main.ts` y en `realtime.gateway.ts`, y esa duplicación es de la clase peligrosa:
 * el gateway lo lee dentro de un decorador, que se evalúa **al cargar el módulo**, así que no puede
 * inyectar `ConfigService`. Compartir la función pura es la única forma de que los dos coincidan
 * sin que uno tenga que acordarse del otro.
 *
 * Se valida al arrancar y se falla ruidosamente, con la misma postura que `jwt.config.ts` tiene con
 * los secretos: una lista mal escrita —una coma de más, un origen con barra final, un `https //`—
 * no da error, simplemente **no coincide con nada**, y el síntoma es que toda la aplicación deja de
 * cargar datos con un error de CORS en la consola del navegador que nadie mira hasta el día
 * siguiente.
 */

const LOCAL_DEFAULT = ['http://localhost:3000'];

export class CorsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorsConfigError';
  }
}

/**
 * Un origen es `esquema://host[:puerto]`, sin ruta y sin barra final.
 *
 * La barra final importa de verdad: `new URL('http://x/')` es válida y su `origin` es
 * `http://x`, pero el navegador compara la cabecera **como cadena**, así que `http://x/` en la
 * lista nunca coincide con el `Origin: http://x` que manda. Es el error más común y el más difícil
 * de ver a simple vista.
 */
function normalize(raw: string): string {
  const value = raw.trim();
  if (!value) throw new CorsConfigError('Hay un origen vacío en CORS_ORIGINS.');

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CorsConfigError(
      `«${value}» no es un origen válido en CORS_ORIGINS. Se espera algo como https://midominio.com`,
    );
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new CorsConfigError(
      `«${value}» lleva ruta o parámetros. Un origen es solo esquema, host y puerto.`,
    );
  }

  return url.origin;
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') return LOCAL_DEFAULT;

  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(normalize);

  if (origins.length === 0) {
    throw new CorsConfigError('CORS_ORIGINS está definida pero no contiene ningún origen.');
  }

  return [...new Set(origins)];
}

/**
 * La lista que usan `main.ts` y el gateway. Lanza si la configuración no vale.
 *
 * Avisa —sin lanzar— cuando en producción se cae al default de localhost: no es un error
 * técnico (la aplicación arranca) pero sí un despliegue que no va a funcionar desde ningún
 * navegador que no sea el de la propia máquina, y merece una línea en el log de arranque.
 */
export function corsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = parseCorsOrigins(env.CORS_ORIGINS);

  if (env.NODE_ENV === 'production' && env.CORS_ORIGINS === undefined) {
    console.warn(
      '[cors] CORS_ORIGINS no está definida y se usa el default de desarrollo ' +
        `(${LOCAL_DEFAULT.join(', ')}). Ningún navegador fuera de esta máquina podrá usar la API.`,
    );
  }

  return origins;
}
