import type {
  CreateOrderItemPayload,
  CreateOrderPayload,
  UpdateOrderItemPayload,
  UpdateOrderItemStatusPayload,
  UpdateOrderStatusPayload,
} from '@loklflow/types';
import { mutate, type MutateResult } from '@/lib/offline/mutate';
import { withItemId, withOrderIds } from './orders.api';

/**
 * Las mismas operaciones de `ordersApi`, pero por el transporte que sabe diferir.
 *
 * Existe como archivo aparte y no como opción de `ordersApi` por una razón de alcance: solo las
 * pantallas operativas —mesero, cocina, caja— pueden trabajar sin servidor. El panel de
 * administración se renderiza en el servidor y sin él no hay nada que hacer, así que darle un
 * camino que encola operaciones sería ofrecer una promesa que la pantalla no puede cumplir.
 *
 * **Las claves de idempotencia se reutilizan, no se reinventan**: `withOrderIds` y `withItemId`
 * son las de `orders.api.ts`. Un segundo sitio que acuñara claves divergiría del primero, y el
 * síntoma sería una comanda duplicada en producción meses después.
 *
 * La partición es lo que ordena la cola. Todo lo de una cuenta va a `order:<id>` para que
 * «añadir ítem» no pueda adelantar a «crear la comanda»; el resto del salón avanza en paralelo.
 */

export const orderPartition = (orderId: string) => `order:${orderId}`;

/**
 * Abre una cuenta.
 *
 * Devuelve además el `id` acuñado, y eso no es comodidad: sin conexión el servidor no contesta,
 * así que la pantalla necesita el identificador **antes** de navegar a la comanda. Es la razón
 * de que el id se acuñe aquí arriba y no dentro de `mutate`.
 */
export async function createOrder(
  payload: CreateOrderPayload,
): Promise<{ id: string; result: MutateResult }> {
  const body = withOrderIds(payload);
  const result = await mutate({
    kind: 'order.create',
    partition: orderPartition(body.id),
    method: 'POST',
    path: '/orders',
    body,
  });
  return { id: body.id, result };
}

export function addItem(orderId: string, payload: CreateOrderItemPayload) {
  return mutate({
    kind: 'order.addItem',
    partition: orderPartition(orderId),
    method: 'POST',
    path: `/orders/${orderId}/items`,
    body: withItemId(payload),
  });
}

export function updateItem(orderId: string, itemId: string, payload: UpdateOrderItemPayload) {
  return mutate({
    kind: 'order.updateItem',
    partition: orderPartition(orderId),
    method: 'PATCH',
    path: `/orders/${orderId}/items/${itemId}`,
    body: payload,
  });
}

export function removeItem(orderId: string, itemId: string) {
  return mutate({
    kind: 'order.removeItem',
    partition: orderPartition(orderId),
    method: 'DELETE',
    path: `/orders/${orderId}/items/${itemId}`,
  });
}

export function updateStatus(orderId: string, payload: UpdateOrderStatusPayload) {
  return mutate({
    kind: 'order.status',
    partition: orderPartition(orderId),
    method: 'PATCH',
    path: `/orders/${orderId}/status`,
    body: payload,
  });
}

export function updateItemStatus(
  orderId: string,
  itemId: string,
  payload: UpdateOrderItemStatusPayload,
) {
  return mutate({
    kind: 'orderItem.status',
    partition: orderPartition(orderId),
    method: 'PATCH',
    path: `/orders/${orderId}/items/${itemId}/status`,
    body: payload,
  });
}

export const ordersOffline = {
  createOrder,
  addItem,
  updateItem,
  removeItem,
  updateStatus,
  updateItemStatus,
};
