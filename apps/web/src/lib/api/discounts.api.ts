import { api } from './client';
import type { Discount, DiscountStatus, DiscountType, Paginated } from '@loklflow/types';

export interface RequestDiscountPayload {
  type: DiscountType;
  value: number;
  reason: string;
}

export const discountsApi = {
  /** Solicita un descuento. Se aplica solo si cabe en el umbral del rol. */
  request: (orderId: string, payload: RequestDiscountPayload) =>
    api.post<Discount>(`/orders/${orderId}/discount`, payload),

  history: (orderId: string) =>
    api.get<Paginated<Discount>>(`/orders/${orderId}/discounts`),

  list: (params: { status?: DiscountStatus; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', String(params.page));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<Paginated<Discount>>(`/discounts${suffix}`);
  },

  pendingCount: () => api.get<{ count: number }>('/discounts/pending-count'),

  approve: (id: string) => api.post<Discount>(`/discounts/${id}/approve`),

  reject: (id: string, reason?: string) =>
    api.post<Discount>(`/discounts/${id}/reject`, reason ? { reason } : {}),
};
