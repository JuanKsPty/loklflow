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

export const ordersApi = {
  getAll: (status?: string) =>
    api.get<Order[]>(`/orders${status ? `?status=${status}` : ''}`),
  getOne: (id: string) => api.get<Order>(`/orders/${id}`),
  /**
   * El id de la orden y el de cada ítem se generan aquí, en el dispositivo, no en el servidor.
   *
   * Se inyectan en este único sitio y no en las llamadas, para que ninguna se olvide. El
   * backend ya los acepta y los usa como clave primaria: reenviar la misma petición devuelve
   * la orden existente en vez de crear una segunda, así que un doble clic deja de duplicar
   * la comanda. Si quien llama trae su propio id —lo hará la cola sin conexión— se respeta.
   */
  create: (payload: CreateOrderPayload) =>
    api.post<Order>('/orders', {
      ...payload,
      id: payload.id ?? newClientId(),
      items: payload.items.map((item) => ({ ...item, id: item.id ?? newClientId() })),
    }),
  addItem: (id: string, payload: CreateOrderItemPayload) =>
    api.post<Order>(`/orders/${id}/items`, { ...payload, id: payload.id ?? newClientId() }),
  updateItem: (id: string, itemId: string, payload: UpdateOrderItemPayload) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}`, payload),
  removeItem: (id: string, itemId: string) =>
    api.delete<Order>(`/orders/${id}/items/${itemId}`),
  updateStatus: (id: string, payload: UpdateOrderStatusPayload) =>
    api.patch<Order>(`/orders/${id}/status`, payload),
  updateItemStatus: (id: string, itemId: string, payload: UpdateOrderItemStatusPayload) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}/status`, payload),
};
