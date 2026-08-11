import { QueryFailedError } from 'typeorm';

/**
 * ¿Este error significa «otra petición escribió esta misma fila al mismo tiempo»?
 *
 * Existe porque la idempotencia de la cola sin conexión es un **read-then-write**: se busca la
 * fila por el id que trae el dispositivo y, si no está, se inserta. Entre la lectura y la
 * inserción cabe otra petición, y eso no es teórico — es el caso normal cuando un reenvío se
 * solapa con el original, o cuando el mesero toca dos veces.
 *
 * Postgres resuelve esa carrera de **dos formas distintas**, y ahí estaba el fallo: se atrapaba
 * solo la violación de unicidad (`23505`), pero cuando las dos transacciones insertan también las
 * filas en cascada —los ítems y el historial— toman los cerrojos en distinto orden y Postgres mata
 * a una con **`40P01 deadlock detected`**. Ese caso caía al `throw` y salía como 500, que para la
 * cola es un fallo definitivo: la comanda acababa en la bandeja de fallos habiendo sido creada.
 *
 * Se comprueba por **código de estado del driver**, no por el texto del mensaje: los mensajes de
 * Postgres están traducidos según el `lc_messages` del servidor, así que un `/duplicate/i` deja de
 * coincidir en cuanto la base habla otro idioma.
 */

/** Códigos de la clase 23 (integridad) y 40 (fallo de transacción) que significan «reintenta». */
const CONFLICT_CODES = new Set([
  // unique_violation: la otra petición insertó primero.
  '23505',
  // deadlock_detected: las dos insertaron a la vez y Postgres eligió víctima.
  '40P01',
  // serialization_failure: mismo significado con un nivel de aislamiento más estricto.
  '40001',
]);

export function isConcurrentWriteConflict(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code = (err as QueryFailedError & { code?: string }).code;
  return typeof code === 'string' && CONFLICT_CODES.has(code);
}
