/**
 * Convierte un instante a `YYYY-MM-DD HH:mm:ss` en UTC, sin indicador de zona.
 *
 * Las columnas de fecha del esquema son `timestamp without time zone` y almacenan UTC.
 * Si se les pasa un objeto `Date` como parámetro, node-postgres lo serializa en la zona
 * local del proceso y Postgres se queda con la parte literal, así que la comparación
 * queda desplazada por el offset del servidor. Pasando este string la comparación es
 * literal y no depende de dónde corra el proceso.
 */
export function toUtcTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
