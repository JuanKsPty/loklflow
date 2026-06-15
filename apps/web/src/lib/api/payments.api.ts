import { api } from './client';
import type { CreatePaymentPayload, Order, PaymentSummary } from '@loklflow/types';

export const paymentsApi = {
  summary: (orderId: string) => api.get<PaymentSummary>(`/orders/${orderId}/payments`),
  addPayment: (orderId: string, payload: CreatePaymentPayload) =>
    api.post<PaymentSummary>(`/orders/${orderId}/payments`, payload),
  setTip: (orderId: string, tipAmount: number) =>
    api.patch<Order>(`/orders/${orderId}/tip`, { tipAmount }),
};
