import type { TableStatus } from '@loklflow/types';
import { mutate } from '@/lib/offline/mutate';

/**
 * El cambio de estado de una mesa, por el transporte que sabe diferir.
 *
 * Es la única operación de mesas que se puede encolar, y también la única de toda la cola que
 * dos dispositivos pueden pisarse: el mesero marca la mesa libre sin red mientras la caja la
 * marca ocupada. El desempate lo hace el servidor comparando `occurredAt` con
 * `tables.status_changed_at`, y descarta el hecho más viejo — no la operación que llegue tarde.
 *
 * `reserved` y `maintenance` quedan fuera por decisión de `queueable.ts`, no de este archivo:
 * dependen de lo que sepan los demás dispositivos. Si se intentan sin red, `mutate` devuelve
 * `rejected` con el motivo escrito para el operario.
 */

export const tablePartition = (tableId: string) => `table:${tableId}`;

export function updateTableStatus(tableId: string, status: TableStatus) {
  return mutate({
    kind: 'table.status',
    partition: tablePartition(tableId),
    method: 'PATCH',
    path: `/tables/${tableId}/status`,
    body: { status },
  });
}

export const tablesOffline = { updateTableStatus };
