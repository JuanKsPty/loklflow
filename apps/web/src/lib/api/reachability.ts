/**
 * ¿Llega esto al servidor? Contado por las peticiones de verdad.
 *
 * Es la señal de conectividad más fiable que existe en la aplicación: no es una opinión sobre
 * el estado de la red como `navigator.onLine`, ni una sonda periódica que llega tarde, sino el
 * resultado de una petición que alguien acaba de hacer.
 *
 * Vive en la capa HTTP y no en el módulo de la cola porque **todas** las peticiones tienen que
 * alimentarla, no solo las mutaciones diferibles. Cuando estaba dentro de `mutate`, un cobro
 * fallido —que no pasa por la cola, porque cobrar nunca se difiere— no movía el indicador, así
 * que el cajero seguía viendo «Al día» mientras nada llegaba, y la pantalla no se enteraba de la
 * caída hasta el siguiente sondeo, treinta segundos después.
 *
 * Módulo aparte de `client.ts` para que la cola y el proveedor de React puedan suscribirse sin
 * arrastrar el cliente HTTP entero, y para que no haya ciclos de importación.
 */

export type Reachability = 'reached' | 'unreachable';

const listeners = new Set<(state: Reachability) => void>();

export function onReachability(listener: (state: Reachability) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceReachability(state: Reachability): void {
  for (const listener of listeners) listener(state);
}
