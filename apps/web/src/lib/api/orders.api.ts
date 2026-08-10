import { api } from './client';
import { newClientId } from '../client-id';
import type {
  Order,
  CreateOrderPayload,
  CreateOrderItemPayload,
  UpdateOrderItemPayload,
  UpdateOrderStatusPayload,
  UpdateOrderItemStatusPayload,
} from '@loklflow/types';

/**
 * El id de la orden y el de cada ítem se generan aquí, en el dispositivo, no en el servidor.
 *
 * Se acuñan en **un único sitio** y no en las llamadas, para que ninguna se olvide. El backend
 * los acepta y los usa como clave primaria: reenviar la misma petición devuelve la orden
 * existente en vez de crear una segunda, así que un doble clic deja de duplicar la comanda. Si
 * quien llama trae su propio id se respeta.
 *
 * Están exportadas —y no dentro de `create`— porque el transporte sin conexión necesita **las
 * mismas** claves antes de encolar: la partición de una comanda diferida es `order:<id>`, y ese
 * id tiene que existir antes de que la operación entre en la cola. Un segundo sitio que acuñara
 * claves acabaría divergiendo de este; compartir la función hace que no pueda pasar.
 */
export function withOrderIds(payload: CreateOrderPayload): CreateOrderPayload & { id: string } {
  return {
    ...payload,
    id: payload.id ?? newClientId(),
    items: payload.items.map((item) => ({ ...item, id: item.id ?? newClientId() })),
  };
}

export function withItemId(
  payload: CreateOrderItemPayload,
): CreateOrderItemPayload & { id: string } {
  return { ...payload, id: payload.id ?? newClientId() };
}

export const ordersApi = {
  getAll: (status?: string) =>
    api.get<Order[]>(`/orders${status ? `?status=${status}` : ''}`),
  getOne: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (payload: CreateOrderPayload) => api.post<Order>('/orders', withOrderIds(payload)),
  addItem: (id: string, payload: CreateOrderItemPayload) =>
    api.post<Order>(`/orders/${id}/items`, withItemId(payload)),
  updateItem: (id: string, itemId: string, payload: UpdateOrderItemPayload) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}`, payload),
  removeItem: (id: string, itemId: string) =>
    api.delete<Order>(`/orders/${id}/items/${itemId}`),
  updateStatus: (id: string, payload: UpdateOrderStatusPayload) =>
    api.patch<Order>(`/orders/${id}/status`, payload),
  updateItemStatus: (id: string, itemId: string, payload: UpdateOrderItemStatusPayload) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}/status`, payload),
};
