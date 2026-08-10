import { api, replayApi, OfflineError } from '@/lib/api/client';
import { isQueueable, whyNotQueueable, type OperationKind } from './queueable';
import { enqueue, drain, type DrainResult, type QueuedOperation } from './outbox';
import { probe } from './net';

/**
 * El punto único por el que pasan las mutaciones que se pueden diferir.
 *
 * **En este bloque no lo llama ninguna pantalla.** Es deliberado: la maquinaria entra probada
 * y sin cambiar el comportamiento de la aplicación, y el cableado se hace en el bloque del
 * mesero, donde puede verificarse pantalla a pantalla. Un núcleo offline que se cablea el
 * mismo día que se escribe es un núcleo que nadie ha visto fallar por separado.
 */

export interface MutateInput {
  kind: OperationKind;
  partition: string;
  method: QueuedOperation['method'];
  path: string;
  body?: unknown;
}

export type MutateResult =
  | { outcome: 'sent'; data: unknown }
  /** No había red y la operación quedó en la cola. La pantalla puede pintarla como hecha. */
  | { outcome: 'queued'; operation: QueuedOperation }
  /** No hay red y esta operación no se puede diferir. `reason` se le enseña al operario. */
  | { outcome: 'rejected'; reason: string };

/**
 * Aviso de que una petición real llegó al servidor, o no.
 *
 * Es la señal de conectividad **más fiable que existe en la aplicación**, mejor que
 * `navigator.onLine` y que cualquier sonda: no es una opinión sobre el estado de la red, es el
 * resultado de una petición que de verdad hizo el operario. El indicador de conexión se
 * suscribe aquí, así que cambia en el instante en que el mesero toca algo y no llega.
 *
 * Vive en este módulo y no en el proveedor de React para que `mutate` siga siendo probable en
 * Node y no dependa de que haya un árbol montado.
 */
export type Reachability = 'reached' | 'unreachable';

const listeners = new Set<(state: Reachability) => void>();

export function onReachability(listener: (state: Reachability) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(state: Reachability): void {
  for (const listener of listeners) listener(state);
}

export async function mutate(input: MutateInput): Promise<MutateResult> {
  try {
    const data = await send(input.method, input.path, input.body);
    announce('reached');
    return { outcome: 'sent', data };
  } catch (err) {
    // Solo un fallo de red lleva a la cola. Si el servidor contestó —aunque sea un 400— ya
    // decidió, y encolar sería reintentar eternamente algo que ya está resuelto.
    if (!(err instanceof OfflineError)) {
      // Un 4xx es una respuesta: significa que el servidor está ahí y contestó que no.
      announce('reached');
      throw err;
    }
    announce('unreachable');

    if (!isQueueable({ kind: input.kind, status: statusOf(input.body) })) {
      return {
        outcome: 'rejected',
        reason: whyNotQueueable({ kind: input.kind, status: statusOf(input.body) })!,
      };
    }

    const operation = await enqueue(input);
    return { outcome: 'queued', operation };
  }
}

/**
 * Intenta vaciar la cola, si de verdad hay servidor al otro lado.
 *
 * El reenvío va por `replayApi` y no por `api`: este último, ante un 401 que el refresco no
 * arregla, hace `window.location.href = '/login'` —desde dentro del bucle de drenado—, lo que
 * tira la pantalla a media sincronización y deja al operario sin saber qué se envió.
 */
export async function flush(): Promise<DrainResult> {
  if (!(await probe())) return { sent: 0, failed: 0, retry: 0, needsAuth: false };
  return drain(async (op) => {
    await send(op.method, op.path, withOccurredAt(op.body, op.occurredAt), replayApi);
  });
}

type Client = Pick<typeof api, 'post' | 'patch' | 'put' | 'delete'>;

function send(
  method: QueuedOperation['method'],
  path: string,
  body?: unknown,
  client: Client = api,
) {
  switch (method) {
    case 'POST':
      return client.post<unknown>(path, body);
    case 'PATCH':
      return client.patch<unknown>(path, body);
    case 'PUT':
      return client.put<unknown>(path, body);
    case 'DELETE':
      return client.delete<unknown>(path);
  }
}

/**
 * Adjunta la hora del hecho al cuerpo que se reenvía.
 *
 * Sin esto, una comanda tomada a las 20:10 y enviada a las 21:30 queda registrada a las 21:30:
 * la bitácora miente y el informe de tiempos de preparación pasa a medir cuándo volvió el WiFi.
 *
 * El servidor lo declara en los seis DTOs que una operación encolable puede alcanzar, y lo
 * guarda en `orders.occurred_at` y `order_status_history.occurred_at`. Eso no es opcional: el
 * pipe global corre con `forbidNonWhitelisted`, así que sin declararlo **toda** operación
 * reenviada recibiría un 400 y acabaría en la bandeja de fallos.
 */
function withOccurredAt(body: unknown, occurredAt: string): unknown {
  if (body === undefined || body === null) return { occurredAt };
  if (typeof body !== 'object' || Array.isArray(body)) return body;
  return { ...(body as Record<string, unknown>), occurredAt };
}

function statusOf(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const status = (body as Record<string, unknown>).status;
  return typeof status === 'string' ? status : undefined;
}
