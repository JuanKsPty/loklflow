import { cache } from 'react';
import type { ShiftSummary } from '@loklflow/types';
import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';

/**
 * El turno de caja abierto, para los cascarones de servidor.
 *
 * Envuelto en `cache()` de React, que **deduplica por petición**: `/pos` lo pedía en el layout y
 * otra vez en la página, así que la pantalla más caliente del producto hacía dos veces la misma
 * consulta en cada carga. Con esto es una, sin tocar a ninguna de las dos.
 *
 * **Sin parámetros a propósito.** `cache()` deduplica por argumentos, así que pasarle el ámbito
 * del reporte —`'pos:layout'` en un sitio, `'pos:page'` en el otro— haría dos entradas distintas
 * y la deduplicación no ocurriría. La traza usa un ámbito único, que además es más honesto:
 * el fallo es de esta consulta, no de quien la pidió.
 *
 * `undefined` significa «no se pudo consultar» y es distinto de `null`, que significa «no hay
 * turno abierto». Confundirlos hacía que un fallo de red pintara «Abrir turno» sobre un turno ya
 * abierto — y abrirlo entonces choca contra el índice único parcial, así que el cajero se
 * quedaba mirando un error sin saber qué había pasado.
 */
export const currentShift = cache(async (): Promise<ShiftSummary | null | undefined> => {
  try {
    return await serverFetch<ShiftSummary | null>('/shifts/current');
  } catch (err) {
    reportApiFailure('shifts:current', err);
    return undefined;
  }
});
