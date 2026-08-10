import Dexie, { type Table } from 'dexie';
import type { QueuedOperation } from './outbox';

/**
 * La capa de almacenamiento local, sobre Dexie.
 *
 * Empezó siendo un envoltorio propio de un centenar de líneas, y para guardar y leer estaba
 * bien. Lo que decidió el cambio fue el **número de orden de la cola**: asignarlo leyendo el
 * máximo y sumando uno deja una carrera entre pestañas —las dos leen el mismo máximo y las dos
 * escriben el mismo número—, y el orden dentro de una cuenta es justo la garantía de la que
 * depende que «añadir ítem» no llegue antes que «crear la comanda». Con una clave primaria
 * autoincremental lo resuelve IndexedDB de forma atómica: el problema desaparece en lugar de
 * estrecharse.
 *
 * **`indexedDB` no existe en el servidor.** Nada aquí puede tocarlo en el ámbito superior:
 * `apps/web` renderiza en el servidor de Next, y una referencia fuera de una función rompería
 * el render de cualquier página que importe este módulo aunque no llegue a usarlo. Por eso la
 * instancia se crea de forma perezosa y no como constante del módulo.
 */

/** Cola de operaciones pendientes de enviar. */
export const OUTBOX = 'outbox';
/**
 * Copia local de datos del servidor. No se llena hasta el bloque del mesero sin conexión, pero
 * el almacén se declara ahora: subir la versión del esquema más adelante obliga a una
 * migración en dispositivos que ya tienen datos, y eso es trabajo por nada.
 */
export const CACHE = 'cache';

export interface CachedRow {
  collection: string;
  id: string;
  value: unknown;
  /** Cuándo se sembró. Lo necesita el desalojo del bloque 5. */
  updatedAt: number;
}

class LoklflowDb extends Dexie {
  outbox!: Table<QueuedOperation, number>;
  cache!: Table<CachedRow, [string, string]>;

  constructor() {
    super('loklflow');
    this.version(1).stores({
      // `++seq` es el punto de todo esto: la base asigna el orden, no el cliente.
      // El resto son **índices**, no columnas — Dexie guarda el objeto entero igual—, y están
      // para que las consultas no tengan que traerse la cola completa y filtrar en memoria.
      outbox: '++seq, id, partition, status, createdAt',
      cache: '[collection+id], collection',
    });
  }
}

export function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

let instance: LoklflowDb | null = null;

/**
 * La base, creada al primer uso.
 *
 * Lanza si no hay IndexedDB en lugar de devolver algo inservible: quien llama desde un camino
 * que puede ejecutarse en el servidor tiene que preguntar antes con `isSupported()`, y así el
 * fallo aparece donde está el error y no tres capas más abajo.
 */
export function db(): LoklflowDb {
  if (!isSupported()) throw new Error('IndexedDB no está disponible en este entorno');
  instance ??= new LoklflowDb();
  return instance;
}

export const outbox = (): Table<QueuedOperation, number> => db().outbox;
export const cache = (): Table<CachedRow, [string, string]> => db().cache;

/** Solo para los tests: cierra y olvida la conexión memoizada. */
export function resetConnection(): void {
  instance?.close();
  instance = null;
}

/** Vacía un almacén. Lo usan los tests entre casos. */
export async function clear(store: string): Promise<void> {
  await db().table(store).clear();
}
