import type { Order, OrderItemStatus, OrderStatus, RestaurantTable, TableStatus } from '@loklflow/types';
import type { QueuedOperation } from './outbox';

/**
 * Superpone lo que está en la cola sobre lo que dice la copia local.
 *
 * Sin esto, un mesero sin red toca «lista», la operación se encola correctamente… y la pantalla
 * sigue diciendo «en preparación», porque la copia local es lo último que contó el servidor. El
 * trabajo se guardó pero el operario no tiene forma de saberlo, así que lo vuelve a tocar.
 *
 * **Qué se superpone aquí y qué no.** Aquí solo lo que se puede reconstruir del propio cuerpo de
 * la operación: estados, cantidades y borrados, que son valores absolutos. Abrir una cuenta o
 * añadir un producto necesitan el precio y el nombre del catálogo, y eso solo lo tiene la
 * pantalla que hizo la acción — así que esas dos escriben su fila optimista en la copia local en
 * el momento, y no se reconstruyen desde la cola. Reconstruir un precio aquí sería inventarlo.
 *
 * Es una función pura sobre listas ya leídas: no toca IndexedDB, así que se prueba sin base y
 * se puede llamar en cada render sin coste.
 */

/** `/orders/<uuid>/items/<uuid>/status` → el id de la línea. `undefined` si la ruta no encaja. */
function itemIdOf(path: string): string | undefined {
  return /\/items\/([^/]+)/.exec(path)?.[1];
}

function idOfPartition(partition: string, prefix: string): string | undefined {
  return partition.startsWith(`${prefix}:`) ? partition.slice(prefix.length + 1) : undefined;
}

function bodyOf(op: QueuedOperation): Record<string, unknown> {
  return op.body && typeof op.body === 'object' && !Array.isArray(op.body)
    ? (op.body as Record<string, unknown>)
    : {};
}

/** Marca de que la fila lleva cambios sin enviar, para que la interfaz pueda decirlo. */
export interface WithPending {
  pendingSync?: boolean;
}

export function applyPendingToTables(
  tables: (RestaurantTable & WithPending)[],
  ops: QueuedOperation[],
): (RestaurantTable & WithPending)[] {
  const byId = new Map(tables.map((t) => [t.id, { ...t }]));

  for (const op of ops) {
    if (op.kind !== 'table.status') continue;
    const id = idOfPartition(op.partition, 'table');
    const table = id ? byId.get(id) : undefined;
    if (!table) continue;
    const status = bodyOf(op).status;
    if (typeof status !== 'string') continue;
    table.status = status as TableStatus;
    table.pendingSync = true;
  }

  return [...byId.values()];
}

export function applyPendingToOrder(
  order: (Order & WithPending) | undefined,
  ops: QueuedOperation[],
): (Order & WithPending) | undefined {
  if (!order) return order;

  let result: Order & WithPending = { ...order, items: order.items ? [...order.items] : [] };

  for (const op of ops) {
    const body = bodyOf(op);

    switch (op.kind) {
      case 'order.status': {
        if (typeof body.status !== 'string') break;
        result = { ...result, status: body.status as OrderStatus, pendingSync: true };
        break;
      }
      case 'orderItem.status': {
        const itemId = itemIdOf(op.path);
        if (!itemId || typeof body.status !== 'string') break;
        result = {
          ...result,
          items: (result.items ?? []).map((item) =>
            item.id === itemId ? { ...item, status: body.status as OrderItemStatus } : item,
          ),
          pendingSync: true,
        };
        break;
      }
      case 'order.updateItem': {
        const itemId = itemIdOf(op.path);
        if (!itemId) break;
        result = {
          ...result,
          items: (result.items ?? []).map((item) => {
            if (item.id !== itemId) return item;
            const quantity = typeof body.quantity === 'number' ? body.quantity : item.quantity;
            return {
              ...item,
              quantity,
              // El subtotal se recalcula con el precio ya guardado en la línea: es un dato del
              // servidor, no inventado aquí. El total de la cuenta lo rehace `recomputeTotals`.
              subtotal: Number((item.unitPrice * quantity).toFixed(2)),
              notes: typeof body.notes === 'string' ? body.notes : item.notes,
            };
          }),
          pendingSync: true,
        };
        break;
      }
      case 'order.removeItem': {
        const itemId = itemIdOf(op.path);
        if (!itemId) break;
        result = {
          ...result,
          items: (result.items ?? []).filter((item) => item.id !== itemId),
          pendingSync: true,
        };
        break;
      }
      default:
        // `order.create` y `order.addItem` los escribe la pantalla en el momento: necesitan el
        // catálogo para saber precio y nombre, y aquí solo hay el cuerpo de la petición.
        break;
    }
  }

  return recomputeTotals(result);
}

/**
 * Rehace subtotal y total de la cuenta tras superponer la cola.
 *
 * **No toca el descuento ni la propina**, y eso es deliberado: los dos son operaciones que la
 * cola nunca difiere, así que sus valores vienen siempre del servidor y suponerlos aquí sería
 * enseñar un total que nadie ha cobrado. Este número es orientativo mientras haya pendientes;
 * el bueno lo fija el servidor al sincronizar.
 */
function recomputeTotals(order: Order & WithPending): Order & WithPending {
  if (!order.pendingSync || !order.items) return order;
  const subtotal = order.items
    .filter((item) => item.status !== 'cancelled')
    .reduce((sum, item) => sum + Number(item.subtotal), 0);
  return {
    ...order,
    subtotal: Number(subtotal.toFixed(2)),
    total: Number((subtotal - Number(order.discountAmount) + Number(order.tipAmount)).toFixed(2)),
  };
}

export function applyPendingToOrders(
  orders: (Order & WithPending)[],
  opsByPartition: Map<string, QueuedOperation[]>,
): (Order & WithPending)[] {
  return orders.map((order) => {
    const ops = opsByPartition.get(`order:${order.id}`);
    return ops && ops.length > 0 ? (applyPendingToOrder(order, ops) ?? order) : order;
  });
}

/**
 * Los ids de las entidades con algo en la cola.
 *
 * Lo usan las vistas para que el reemplazo de una colección **no borre** lo que el servidor
 * todavía no conoce: una cuenta abierta sin conexión no viene en su respuesta.
 */
export function pendingIds(ops: QueuedOperation[], prefix: 'order' | 'table'): string[] {
  const ids = new Set<string>();
  for (const op of ops) {
    const id = idOfPartition(op.partition, prefix);
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Agrupa la cola por partición, que es como la consultan las vistas. */
export function byPartition(ops: QueuedOperation[]): Map<string, QueuedOperation[]> {
  const groups = new Map<string, QueuedOperation[]>();
  for (const op of ops) {
    groups.set(op.partition, [...(groups.get(op.partition) ?? []), op]);
  }
  return groups;
}
