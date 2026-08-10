import { api, OfflineError } from '@/lib/api/client';
import { isQueueable, whyNotQueueable, type OperationKind } from './queueable';
import { enqueue, drain, type QueuedOperation } from './outbox';
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

export async function mutate(input: MutateInput): Promise<MutateResult> {
  try {
    const data = await send(input.method, input.path, input.body);
    return { outcome: 'sent', data };
  } catch (err) {
    // Solo un fallo de red lleva a la cola. Si el servidor contestó —aunque sea un 400— ya
    // decidió, y encolar sería reintentar eternamente algo que ya está resuelto.
    if (!(err instanceof OfflineError)) throw err;

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

/** Intenta vaciar la cola, si de verdad hay servidor al otro lado. */
export async function flush(): Promise<void> {
  if (!(await probe())) return;
  await drain(async (op) => {
    await send(op.method, op.path, withOccurredAt(op.body, op.occurredAt));
  });
}

function send(method: QueuedOperation['method'], path: string, body?: unknown) {
  switch (method) {
    case 'POST':
      return api.post<unknown>(path, body);
    case 'PATCH':
      return api.patch<unknown>(path, body);
    case 'PUT':
      return api.put<unknown>(path, body);
    case 'DELETE':
      return api.delete<unknown>(path);
  }
}

/**
 * Adjunta la hora del hecho al cuerpo que se reenvía.
 *
 * Sin esto, una comanda tomada a las 20:10 y enviada a las 21:30 queda registrada a las 21:30:
 * la bitácora miente y el informe de tiempos de preparación pasa a medir cuándo volvió el WiFi.
 * El servidor aún no lee este campo —lo hará cuando se cablee la cola—, pero viajar desde ya
 * evita tener que versionar las operaciones que queden en cola de un despliegue al siguiente.
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
