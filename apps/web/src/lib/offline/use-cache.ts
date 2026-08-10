'use client';

import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCollection, getRow, putMany, replaceCollection, type Collection } from './cache';
import { isSupported } from './db';

/**
 * Leer del dispositivo, sembrando con lo que trajo el servidor.
 *
 * El patrón que usan todas las pantallas operativas: la ruta sigue siendo un Server Component
 * con su `serverFetch`, pero en vez de pintar los datos se los pasa como `initial` a una vista
 * de cliente que los siembra y **lee de la copia local**.
 *
 * Los dos detalles que hacen que no parpadee:
 *
 * 1. Mientras `useLiveQuery` tiene su primera consulta en vuelo devuelve `undefined`, y se
 *    responde con `initial`. Sin eso, cada navegación pinta un instante vacío sobre datos que
 *    el servidor ya había mandado.
 * 2. La siembra respeta lo más nuevo. `initial` puede llegar después de que un evento de
 *    socket o una operación encolada hayan escrito algo posterior, y sobrescribir a ciegas
 *    haría retroceder la pantalla.
 *
 * Cuando `initial` es `null` —el servidor no contestó— no se siembra nada y se lee lo que haya:
 * es exactamente el caso que convierte «API caída» en una pantalla que sigue trabajando.
 */

interface Identifiable {
  id: string;
}

export function useCachedCollection<T extends Identifiable>(
  collection: Collection,
  initial: T[] | null,
  /**
   * Si `initial` es la colección completa (y por tanto lo que falte hay que borrarlo) o solo
   * un trozo. Los listados mandan la completa; una ficha suelta, no.
   */
  mode: 'replace' | 'merge' = 'replace',
): T[] {
  const seeded = useRef(false);

  useEffect(() => {
    if (!initial || seeded.current || !isSupported()) return;
    seeded.current = true;
    const seed = mode === 'replace' ? replaceCollection : putMany;
    void seed(collection, initial);
  }, [collection, initial, mode]);

  const rows = useLiveQuery(
    () => (isSupported() ? getCollection<T>(collection) : Promise.resolve([])),
    [collection],
  );

  return rows ?? initial ?? [];
}

export function useCachedRow<T extends Identifiable>(
  collection: Collection,
  id: string,
  initial: T | null,
): T | undefined {
  const seeded = useRef(false);

  useEffect(() => {
    if (!initial || seeded.current || !isSupported()) return;
    seeded.current = true;
    void putMany(collection, [initial]);
  }, [collection, initial]);

  const row = useLiveQuery(
    () => (isSupported() ? getRow<T>(collection, id) : Promise.resolve(undefined)),
    [collection, id],
  );

  return row ?? initial ?? undefined;
}
