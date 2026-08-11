'use client';

import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { api } from '@/lib/api/client';
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
  /**
   * Ids que no se pueden borrar aunque no vengan en `initial`.
   *
   * Sin esto, en modo `replace`, una cuenta abierta sin conexión —que existe en el dispositivo
   * y no en el servidor— desaparecería en el siguiente refresco del listado, con su comanda
   * dentro, mientras la cola seguiría enviando operaciones contra algo invisible.
   */
  protect: Iterable<string> = [],
): T[] {
  // Sin bandera de «ya sembrado»: `initial` cambia de identidad en cada render del cascarón de
  // servidor, y una bandera haría que un refresco posterior se ignorara en silencio. Sembrar de
  // nuevo es inocuo porque `putMany` respeta lo más nuevo y `replaceCollection` protege lo que
  // tiene operaciones pendientes.
  const protectKey = [...protect].sort().join(',');
  useEffect(() => {
    if (!initial || !isSupported()) return;
    if (mode === 'replace') {
      void replaceCollection(collection, initial, { protect: protectKey ? protectKey.split(',') : [] });
    } else {
      void putMany(collection, initial);
    }
  }, [collection, initial, mode, protectKey]);

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
  useEffect(() => {
    if (!initial || !isSupported()) return;
    void putMany(collection, [initial]);
  }, [collection, initial]);

  const row = useLiveQuery(
    () => (isSupported() ? getRow<T>(collection, id) : Promise.resolve(undefined)),
    [collection, id],
  );

  return row ?? initial ?? undefined;
}

/**
 * Pide una colección desde el cliente **solo si la copia local está vacía**.
 *
 * Cubre el caso en que el cascarón de servidor no pudo traer nada —`initial` llegó como
 * `null`— y el navegador sí tiene camino hasta la API. El servidor de Next y el dispositivo no
 * siempre fallan juntos, y sin este intento la pantalla se quedaría con el aviso de «sin
 * conexión» para siempre aunque la red ya hubiera vuelto: nada más vuelve a pedir hasta que
 * llegue un evento de socket, que tampoco va a llegar.
 *
 * Solo cuando está vacía: con datos guardados no hace falta, y pedirlos sería una petición por
 * cada montaje de cada pantalla.
 */
export function useHydrateWhenEmpty(
  collection: Collection,
  path: string,
  /** Para una ficha: el id que tiene que existir. Sin él se mira si la colección está vacía. */
  rowId?: string,
): void {
  const load = useCallback(async () => {
    try {
      const data = await api.get<{ id: string } | { id: string }[]>(path);
      await putMany(collection, Array.isArray(data) ? data : [data]);
    } catch {
      // Sin red no hay nada que hacer: la vista ya sabe decir que no tiene datos.
    }
  }, [collection, path]);

  useEffect(() => {
    if (!isSupported()) return;
    const missing = rowId
      ? getRow(collection, rowId).then((row) => row === undefined)
      : getCollection(collection).then((rows) => rows.length === 0);
    void missing.then((empty) => {
      if (empty) void load();
    });
  }, [collection, rowId, load]);
}
