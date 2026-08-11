/**
 * Normaliza el `occurredAt` que manda un dispositivo: la hora a la que la acción ocurrió
 * de verdad en el salón, que no es la hora a la que la petición llega al servidor.
 *
 * Sin esto, una comanda tomada a las 21:40 y sincronizada a las 22:05 —cuando vuelve el
 * WiFi— quedaría fechada a las 22:05, y tanto `order_status_history` como el reporte de
 * tiempos de preparación medirían **cuándo volvió la red**, no cuánto tardó la cocina.
 *
 * La política es **recortar, nunca rechazar**. El reloj de una tablet puede estar mal, y
 * una comanda rechazada por eso es infinitamente peor que un sello unos minutos corrido:
 * el mesero se queda sin poder mandar el pedido y no hay nada que pueda hacer al respecto.
 * Así que un valor imposible se descarta en silencio y el servidor usa su propia hora.
 *
 * Se descarta cuando:
 * - no viene, o no parsea como fecha;
 * - está en el futuro (con `FUTURE_TOLERANCE_MS` de margen, porque un desfase de segundos
 *   entre el reloj del dispositivo y el del servidor es normal y no significa nada);
 * - es más viejo que `MAX_AGE_MS`. Una operación de hace tres días no es una comanda que
 *   se sincroniza tarde: es un dispositivo con la fecha mal puesta, o una cola que alguien
 *   resucitó. Fecharla en el pasado remoto ensuciaría los reportes de días ya cerrados.
 */

/** 48 h: cubre un corte largo, un turno de noche y una tablet que pasó el domingo apagada. */
export const MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** 5 min: desfase de reloj tolerable entre un dispositivo y el servidor. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function saneOccurredAt(value: string | undefined | null, now: Date = new Date()): Date | null {
  if (!value) return null;

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;

  const delta = at.getTime() - now.getTime();
  if (delta > FUTURE_TOLERANCE_MS) return null;
  if (-delta > MAX_AGE_MS) return null;

  return at;
}
