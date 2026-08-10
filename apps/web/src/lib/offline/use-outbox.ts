'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { failed, pending, pendingFor, type QueuedOperation } from './outbox';
import { isSupported } from './db';

/**
 * La cola, vista desde React y **al día**.
 *
 * Estos hooks se reejecutan solos cuando la cola cambia, incluso si el cambio lo hizo otra
 * pestaña de la misma tablet. Sin eso, un contador de pendientes se queda congelado en el
 * número que había al montar el componente, y el problema no es estético: el arqueo del bloque
 * de caja tiene que sumar los cobros que aún no han salido, y enseñar un número viejo es
 * hacerle firmar al cajero una diferencia que no es la suya.
 *
 * **Ninguna pantalla los llama todavía.** Entran con el núcleo, probados por debajo a través
 * de los observables que envuelven, para que los bloques siguientes no tengan que inventar la
 * reactividad a la vez que la interfaz.
 *
 * `useLiveQuery` devuelve `undefined` mientras la primera consulta está en vuelo. Se traduce a
 * lista vacía y a cero: quien los use tiene que poder pintar sin ramas, y «todavía no sé» y
 * «no hay nada» se ven igual durante los pocos milisegundos que dura.
 */

export function usePendingOperations(): QueuedOperation[] {
  // La dependencia vacía no es descuido: `useLiveQuery` reejecuta por los cambios de la base,
  // no por los del componente.
  return useLiveQuery(() => (isSupported() ? pending() : Promise.resolve([])), [], []);
}

export function useFailedOperations(): QueuedOperation[] {
  return useLiveQuery(() => (isSupported() ? failed() : Promise.resolve([])), [], []);
}

export function usePendingCount(): number {
  return usePendingOperations().length;
}

/** Lo pendiente de una cuenta o mesa concreta, para marcar en pantalla que va con retraso. */
export function usePendingFor(partition: string): QueuedOperation[] {
  return useLiveQuery(
    () => (isSupported() ? pendingFor(partition) : Promise.resolve([])),
    [partition],
    [],
  );
}
