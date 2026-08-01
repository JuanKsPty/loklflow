import { api } from './client';
import { newClientId } from '../client-id';
import type { CreatePaymentPayload, Order, PaymentSummary } from '@loklflow/types';

export const paymentsApi = {
  summary: (orderId: string) => api.get<PaymentSummary>(`/orders/${orderId}/payments`),
  /**
   * Ningún cobro sale sin clave de idempotencia; si quien llama no la trae, se genera aquí.
   *
   * Ojo con lo que hace y lo que no: una clave generada en esta función es distinta en cada
   * llamada, así que **solo** protege los reintentos que reenvían el mismo cuerpo (el del 401
   * de `apiFetch`, y mañana el de la cola sin conexión). Para que un doble toque no cobre dos
   * veces, la clave tiene que ser estable a lo largo del intento del cajero, y eso lo decide
   * quien llama — lo hace `CheckoutPanel`. Este valor por defecto es la red que garantiza que
   * el campo nunca viaje vacío.
   */
  addPayment: (orderId: string, payload: CreatePaymentPayload) =>
    api.post<PaymentSummary>(`/orders/${orderId}/payments`, {
      ...payload,
      clientRequestId: payload.clientRequestId ?? newClientId(),
    }),
  setTip: (orderId: string, tipAmount: number) =>
    api.patch<Order>(`/orders/${orderId}/tip`, { tipAmount }),
};
