import { api } from './client';
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
  create: (payload: CreateOrderPayload) => api.post<Order>('/orders', payload),
  addItem: (id: string, payload: CreateOrderItemPayload) =>
    api.post<Order>(`/orders/${id}/items`, payload),
  updateItem: (id: string, itemId: string, payload: UpdateOrderItemPayload) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}`, payload),
  removeItem: (id: string, itemId: string) =>
    api.delete<Order>(`/orders/${id}/items/${itemId}`),
  updateStatus: (id: string, payload: UpdateOrderStatusPayload) =>
    api.patch<Order>(`/orders/${id}/status`, payload),
  updateItemStatus: (id: string, itemId: string, payload: UpdateOrderItemStatusPayload) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}/status`, payload),
};
