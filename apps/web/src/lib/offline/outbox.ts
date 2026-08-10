import { liveQuery, type Observable } from 'dexie';
import { ApiError, OfflineError } from '@/lib/api/client';
import { newClientId } from '@/lib/client-id';
import { reportBrowserError } from '@/lib/observability/report';
import { isSupported, outbox } from './db';
import type { OperationKind } from './queueable';

/**
 * La cola de operaciones pendientes de enviar.
 *
 * Cuatro decisiones la definen, y ninguna es cosmética:
 *
 * **FIFO por partición, no global.** Una cuenta con una operación que falla para siempre —un
 * producto que ya no existe— no puede bloquear las diez cuentas del resto del salón. Dentro de
 * una partición sí manda el orden: crear la comanda tiene que llegar antes que añadirle un
 * ítem, y corregir una cantidad después de haberla puesto.
 *
 * **Un 4xx es terminal; la red y un 5xx se reintentan.** Reintentar un 400 es pedirle al
 * servidor mil veces que acepte algo que ya dijo que está mal.
 *
 * **`occurredAt` viaja con la operación.** Sin él, la bitácora y `order_status_history`
 * registran la hora del envío y no la del hecho, y el informe de tiempos de preparación pasa a
 * medir cuándo volvió el WiFi.
 *
 * **Un solo drenador.** Dos pestañas en la misma tablet enviarían cada operación dos veces, y
 * aunque crear una orden y cobrar sean idempotentes en el servidor, fijar un estado no lo es.
 */

export type Terminal = 'sent' | 'failed';

export interface QueuedOperation {
  id: string;
  kind: OperationKind;
  /** Qué se agrupa y se ordena junto: `order:<id>`, `table:<id>`. */
  partition: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Cuándo ocurrió de verdad, en el salón. No cuándo se envió. */
  occurredAt: string;
  /**
   * Orden dentro de la partición, estrictamente creciente. **Lo asigna la base al insertar**,
   * y no se toca nunca más.
   *
   * No vale `createdAt` para esto: `Date.now()` tiene resolución de milisegundo, y un mesero
   * que toca rápido encola varias operaciones dentro del mismo, con lo que el orden entre
   * ellas quedaría al azar — y ese azar puede mandar «añadir ítem» antes que «crear la
   * comanda». Calcularlo en el cliente tampoco basta: leer el máximo y sumar uno deja la
   * misma carrera entre dos pestañas. La clave autoincremental de IndexedDB es atómica.
   */
  seq: number;
  /** Cuándo se encoló, para la antigüedad que se enseña en la bandeja. */
  createdAt: number;
  attempts: number;
  /** Cuándo se intentó por última vez. Es lo que mide el retroceso, no `createdAt`. */
  lastAttemptAt?: number;
  /** Último error, para la bandeja de fallos. */
  lastError?: string;
  status: 'pending' | 'failed';
}

export interface EnqueueInput {
  kind: OperationKind;
  partition: string;
  method: QueuedOperation['method'];
  path: string;
  body?: unknown;
  occurredAt?: string;
}

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export function backoffFor(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
}

export async function enqueue(input: EnqueueInput): Promise<QueuedOperation> {
  const operation: Omit<QueuedOperation, 'seq'> = {
    id: newClientId(),
    kind: input.kind,
    partition: input.partition,
    method: input.method,
    path: input.path,
    body: input.body,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  // `add` sin clave: la asigna la base. Es lo que hace imposible el empate entre pestañas.
  const seq = (await outbox().add(operation as QueuedOperation)) as number;
  return { ...operation, seq };
}

/**
 * Todo lo que hay en la cola, del más antiguo al más nuevo.
 *
 * `orderBy('seq')` recorre el índice de la clave primaria en vez de traerse la cola entera
 * para ordenarla en memoria. Con una cola corta da igual; es la diferencia entre usar los
 * índices declarados y tenerlos de adorno.
 */
export async function list(): Promise<QueuedOperation[]> {
  if (!isSupported()) return [];
  return outbox().orderBy('seq').toArray();
}

/** Lo que espera envío. Por el índice de `status`, no filtrando la cola completa. */
export async function pending(): Promise<QueuedOperation[]> {
  if (!isSupported()) return [];
  return outbox().where('status').equals('pending').sortBy('seq');
}

/** Lo que se rindió y espera decisión humana. Es la bandeja de fallos del bloque final. */
export async function failed(): Promise<QueuedOperation[]> {
  if (!isSupported()) return [];
  return outbox().where('status').equals('failed').sortBy('seq');
}

/** Lo pendiente de una cuenta o una mesa concreta, por el índice de partición. */
export async function pendingFor(partition: string): Promise<QueuedOperation[]> {
  if (!isSupported()) return [];
  const ops = await outbox().where('partition').equals(partition).sortBy('seq');
  return ops.filter((op) => op.status === 'pending');
}

/**
 * Las mismas consultas, pero **vivas**: se reemiten solas cuando la cola cambia, y lo hacen
 * **entre pestañas**.
 *
 * Es la otra mitad de la razón para haber adoptado Dexie. Tres superficies de los bloques
 * siguientes dependen de esto —el contador de pendientes, el arqueo que tiene que contar lo
 * encolado y la bandeja de fallos— y todas fallarían igual: enseñando un número viejo. Un
 * arqueo con un número viejo es una diferencia que el cajero firma creyéndola buena.
 *
 * Devuelven el observable de Dexie y no un hook a propósito: así se prueban en Node, y el
 * envoltorio de React queda en un archivo aparte de tres líneas.
 */
export function observePending(): Observable<QueuedOperation[]> {
  return liveQuery(() => pending());
}

export function observeFailed(): Observable<QueuedOperation[]> {
  return liveQuery(() => failed());
}

export function observePendingCount(): Observable<number> {
  return liveQuery(() => outbox().where('status').equals('pending').count());
}

/**
 * Saca una operación de la cola.
 *
 * Va por `seq` y no por `id` porque `seq` **es** la clave primaria desde que la asigna la base.
 * Borrar por el uuid no fallaba: no borraba nada, y la operación se reenviaba en cada drenado.
 */
export async function remove(seq: number): Promise<void> {
  await outbox().delete(seq);
}

export interface DrainResult {
  sent: number;
  failed: number;
  /** Quedaron para más tarde: no había red o el servidor devolvió 5xx. */
  retry: number;
}

/** Envía una operación. La inyecta el llamador para poder probar la cola sin red. */
export type Sender = (op: QueuedOperation) => Promise<void>;

let draining = false;

/**
 * Vacía la cola.
 *
 * El cerrojo es de dos capas: una bandera de módulo, que cubre dos llamadas en la misma
 * pestaña, y `navigator.locks`, que cubre dos pestañas del mismo navegador. La segunda es la
 * que importa —una tablet con la app abierta dos veces es lo normal, no lo raro— y por eso hay
 * respaldo cuando la API no existe: sin él, en un navegador viejo el cerrojo desaparecería sin
 * hacer ruido, que es la peor forma de perder una garantía.
 */
export async function drain(send: Sender): Promise<DrainResult> {
  if (draining) return { sent: 0, failed: 0, retry: 0 };
  draining = true;
  try {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) return await drainOnce(send);
    return await locks.request('loklflow-outbox', { ifAvailable: true }, async (lock) =>
      // Sin cerrojo disponible hay otra pestaña drenando: no es un error, es el caso que
      // esto viene a evitar.
      lock ? drainOnce(send) : { sent: 0, failed: 0, retry: 0 },
    );
  } finally {
    draining = false;
  }
}

async function drainOnce(send: Sender): Promise<DrainResult> {
  const result: DrainResult = { sent: 0, failed: 0, retry: 0 };
  const queue = await pending();
  if (queue.length === 0) return result;

  // Se agrupa por partición y se recorre cada grupo en orden. Las particiones son
  // independientes entre sí, así que un atasco en una no detiene a las demás.
  const byPartition = new Map<string, QueuedOperation[]>();
  for (const op of queue) {
    byPartition.set(op.partition, [...(byPartition.get(op.partition) ?? []), op]);
  }

  const now = Date.now();
  await Promise.all(
    [...byPartition.values()].map(async (ops) => {
      for (const op of ops) {
        // El retroceso se mide desde la última tentativa. Con la espera pendiente, el resto
        // de la partición tampoco avanza: saltárselo rompería el orden, que es justo lo que
        // la partición garantiza.
        if (op.lastAttemptAt !== undefined && now - op.lastAttemptAt < backoffFor(op.attempts)) {
          result.retry += 1;
          return;
        }

        const outcome = await attempt(op, send);
        if (outcome === 'sent') {
          result.sent += 1;
          continue;
        }
        if (outcome === 'failed') {
          result.failed += 1;
          // Una operación terminal no debe bloquear a las siguientes de su cuenta para
          // siempre: se marca y se sigue. La bandeja de fallos decide qué hacer con ella.
          continue;
        }
        // Reintentable: se para la partición aquí para no romper el orden.
        result.retry += 1;
        return;
      }
    }),
  );

  return result;
}

async function attempt(op: QueuedOperation, send: Sender): Promise<Terminal | 'retry'> {
  try {
    await send(op);
    await remove(op.seq);
    return 'sent';
  } catch (err) {
    if (isTerminal(err)) {
      await outbox().put({
        ...op,
        status: 'failed',
        attempts: op.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: messageOf(err),
      });
      reportBrowserError('outbox:terminal', err, { kind: op.kind, path: op.path });
      return 'failed';
    }

    const attempts = op.attempts + 1;
    // Rendirse tras muchos intentos no es descartar: pasa a la bandeja, donde una persona
    // decide. Perder una comanda en silencio sería peor que cualquier error visible.
    const exhausted = attempts >= MAX_ATTEMPTS;
    // `createdAt` NO se toca. Es la clave de orden dentro de la partición, y moverla al
    // reintentar colaría la operación detrás de otras creadas después: crear la comanda
    // `seq` NO se toca: es la clave de orden dentro de la partición, y moverla al reintentar
    // colaría la operación detrás de otras creadas después. El retroceso lo mide
    // `lastAttemptAt`.
    await outbox().put({
      ...op,
      attempts,
      status: exhausted ? 'failed' : 'pending',
      lastAttemptAt: Date.now(),
      lastError: messageOf(err),
    });
    if (exhausted) reportBrowserError('outbox:exhausted', err, { kind: op.kind });
    return exhausted ? 'failed' : 'retry';
  }
}

/**
 * Un error del que no tiene sentido volver.
 *
 * Los 4xx lo son: el servidor entendió y dijo que no. Un 404 en un borrado es el caso
 * amable —ya no estaba— y también termina, sin ruido. Los 5xx y los fallos de red, no: ahí el
 * servidor ni siquiera pudo decidir.
 */
function isTerminal(err: unknown): boolean {
  if (err instanceof OfflineError) return false;
  if (err instanceof ApiError) return err.status >= 400 && err.status < 500;
  return false;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
}
