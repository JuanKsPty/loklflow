import { liveQuery, type Observable } from 'dexie';
import { cache, isSupported, type CachedRow } from './db';

/**
 * La copia local de lo que el servidor ya contó.
 *
 * El almacén se declaró en la versión 1 del esquema sin que nada lo escribiera, para no tener
 * que subir la versión —y migrar dispositivos con datos dentro— el día que hiciera falta. Este
 * es ese día.
 *
 * **Qué resuelve, en una frase**: las ocho rutas operativas son Server Components con
 * `cache: 'no-store'`, así que sin servidor no renderizan. Con la copia local la pantalla
 * arranca con lo último que supo en vez de con un cartel de error, que es la diferencia entre
 * una tablet que sirve mesas durante el corte y una que no.
 *
 * La clave es `[collection+id]`, así que la mesa 1 y la orden 1 conviven sin pisarse y una
 * colección entera se lee por su índice sin recorrer el resto.
 *
 * **`updatedAt` decide quién gana al sembrar.** El Server Component pasa lo que trajo del
 * servidor, pero puede llegar después de que la pantalla haya escrito algo más nuevo —un
 * refresco por socket, una operación encolada—, y sobrescribir a ciegas haría parpadear la
 * pantalla hacia atrás. Solo se pisa lo más viejo.
 */

/** Los nombres son parte del contrato entre el cascarón de servidor y la vista de cliente. */
export const COLLECTIONS = {
  tables: 'tables',
  sectors: 'sectors',
  orders: 'orders',
  products: 'products',
  categories: 'categories',
  modifiers: 'modifiers',
} as const;

export type Collection = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

interface Identifiable {
  id: string;
}

/**
 * Guarda filas, sin pisar lo que ya sea más nuevo.
 *
 * `at` permite fechar la siembra con la hora en que el servidor respondió, no con la de la
 * hidratación: entre una y otra pueden pasar segundos y un evento de socket.
 */
export async function putMany<T extends Identifiable>(
  collection: Collection,
  rows: T[],
  at: number = Date.now(),
): Promise<void> {
  if (!isSupported() || rows.length === 0) return;

  const table = cache();
  const existing = await table.where('collection').equals(collection).toArray();
  const seenAt = new Map(existing.map((row) => [row.id, row.updatedAt]));

  const fresh = rows
    .filter((row) => (seenAt.get(row.id) ?? 0) <= at)
    .map((row) => ({ collection, id: row.id, value: row, updatedAt: at }));

  if (fresh.length > 0) await table.bulkPut(fresh);
}

/**
 * Reemplaza una colección entera: guarda lo que llega y **borra lo que ya no está**.
 *
 * Es lo que hace falta para los listados. Sin el borrado, una cuenta que se cerró en otro
 * dispositivo se quedaría para siempre en la copia local del mesero, que seguiría viéndola
 * abierta días después. Se usa solo cuando la respuesta del servidor es la colección completa;
 * para un refresco incremental está `putMany`.
 */
export async function replaceCollection<T extends Identifiable>(
  collection: Collection,
  rows: T[],
  at: number = Date.now(),
): Promise<void> {
  if (!isSupported()) return;

  const table = cache();
  const keep = new Set(rows.map((row) => row.id));
  const stale = await table.where('collection').equals(collection).toArray();

  await table.bulkDelete(
    stale.filter((row) => !keep.has(row.id)).map((row) => [row.collection, row.id] as [string, string]),
  );
  await table.bulkPut(rows.map((row) => ({ collection, id: row.id, value: row, updatedAt: at })));
}

export async function getCollection<T>(collection: Collection): Promise<T[]> {
  if (!isSupported()) return [];
  const rows = await cache().where('collection').equals(collection).toArray();
  return rows.map((row) => row.value as T);
}

export async function getRow<T>(collection: Collection, id: string): Promise<T | undefined> {
  if (!isSupported()) return undefined;
  const row = await cache().get([collection, id]);
  return row?.value as T | undefined;
}

export function observeCollection<T>(collection: Collection): Observable<T[]> {
  return liveQuery(() => getCollection<T>(collection));
}

export function observeRow<T>(collection: Collection, id: string): Observable<T | undefined> {
  return liveQuery(() => getRow<T>(collection, id));
}

export async function removeRow(collection: Collection, id: string): Promise<void> {
  if (!isSupported()) return;
  await cache().delete([collection, id]);
}

/**
 * Tira lo viejo de una colección.
 *
 * Una tablet que lleva meses en el local acumularía todas las cuentas cerradas de su historia:
 * IndexedDB tiene cuota, y el navegador que se queda sin ella no avisa, borra. Lo llama la
 * siembra de los listados, que es cuando se sabe qué sigue vivo.
 */
export async function prune(collection: Collection, maxAgeMs: number): Promise<number> {
  if (!isSupported()) return 0;
  const cutoff = Date.now() - maxAgeMs;
  const rows = await cache().where('collection').equals(collection).toArray();
  const old = rows.filter((row) => row.updatedAt < cutoff);
  await cache().bulkDelete(old.map((row) => [row.collection, row.id] as [string, string]));
  return old.length;
}

export type { CachedRow };
