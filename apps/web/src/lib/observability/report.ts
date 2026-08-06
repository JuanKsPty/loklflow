/**
 * El único sitio del web por el que sale un error hacia un log.
 *
 * Es una costura a propósito: el día que haya despliegue y un Sentry, se enchufa aquí y no en
 * las quince llamadas repartidas por las páginas. Hasta entonces escribe una línea JSON, que
 * es lo que un contenedor sabe recoger sin ayuda de nadie.
 *
 * **Lo que nunca sale de aquí**: cabeceras, cuerpos, cookies y cualquier propiedad que el
 * error traiga colgando. Se eligen los campos uno a uno. Un `ApiError` lleva `data` con la
 * respuesta del servidor, y librerías como axios adjuntan la petición entera —con la cabecera
 * `Authorization` dentro—: volcar el objeto sería exactamente la fuga que esto evita.
 */

const MAX_MESSAGE_CHARS = 500;
const MAX_STACK_LINES = 12;
const MAX_STACK_CHARS = 2000;

/**
 * Un JWT: tres tramos base64url separados por puntos, empezando por `eyJ` (que es `{"` en
 * base64). Aparece en mensajes con más facilidad de la que parece —una URL de descarga, un
 * error de verificación que cita el token— y no hay ningún motivo para conservarlo.
 */
const TOKEN_LIKE = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g;

export interface ErrorReport {
  name: string;
  message: string;
  status?: number;
  requestId?: string;
  stack?: string;
  cause?: string;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}… (+${value.length - max})` : value;
}

function clean(value: string, max: number): string {
  return truncate(value.replace(TOKEN_LIKE, '[token]'), max);
}

function numberOf(source: object, key: string): number | undefined {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
}

function stringOf(source: object, key: string): string | undefined {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reduce cualquier cosa lanzada a un puñado de campos seguros.
 *
 * Acepta cualquier cosa porque en JavaScript se puede lanzar cualquier cosa, y el peor
 * momento para que el reporte falle es cuando ya hay un error.
 */
export function describeError(err: unknown): ErrorReport {
  if (!(err instanceof Error)) {
    return { name: typeof err, message: clean(String(err), MAX_MESSAGE_CHARS) };
  }

  const stack = err.stack
    ? clean(err.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n'), MAX_STACK_CHARS)
    : undefined;

  const cause = err.cause;

  return {
    name: err.name,
    message: clean(err.message, MAX_MESSAGE_CHARS),
    // `status` y `requestId` no están en `Error`, pero sí en `ApiError` y `ServerApiError`.
    // Se leen por forma y no por tipo para que este módulo no dependa de los clientes de la
    // API —lo importan tanto el servidor como el navegador.
    ...(numberOf(err, 'status') !== undefined ? { status: numberOf(err, 'status') } : {}),
    ...(stringOf(err, 'requestId') ? { requestId: stringOf(err, 'requestId') } : {}),
    ...(stack ? { stack } : {}),
    ...(cause instanceof Error
      ? { cause: clean(`${cause.name}: ${cause.message}`, MAX_MESSAGE_CHARS) }
      : {}),
  };
}

export type ReportContext = Record<string, string | number | boolean | undefined>;

function entry(scope: string, err: unknown, context?: ReportContext) {
  return {
    level: 'error',
    at: new Date().toISOString(),
    scope,
    ...context,
    error: describeError(err),
  };
}

/**
 * Reporta desde un Server Component, un layout o `instrumentation.ts`.
 *
 * Una línea JSON por `console.error`, que en Next acaba en el stderr del proceso.
 */
export function reportServerError(scope: string, err: unknown, context?: ReportContext): void {
  console.error(JSON.stringify(entry(scope, err, context)));
}

/**
 * Reporta desde el navegador.
 *
 * No se manda nada por la red **a propósito**: sin un destino real, un `fetch` de reporte
 * fallaría justo cuando el error es que no hay conexión, y encima taparía el problema con un
 * segundo error. Queda en la consola del dispositivo hasta que haya dónde enviarlo.
 */
export function reportBrowserError(scope: string, err: unknown, context?: ReportContext): void {
  console.error('[loklflow]', entry(scope, err, context));
}
