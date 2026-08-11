import { api } from './client';
import { newClientId } from '../client-id';
import type { CreatePaymentPayload, Order, PaymentSummary } from '@loklflow/types';

/**
 * Ningún cobro sale sin clave de idempotencia; si quien llama no la trae, se acuña aquí.
 *
 * Ojo con lo que hace y lo que no: una clave generada en esta función es distinta en cada
 * llamada, así que **solo** protege los reintentos que reenvían el mismo cuerpo (el del 401 de
 * `apiFetch`). Para que un doble toque no cobre dos veces, la clave tiene que ser estable a lo
 * largo del intento del cajero, y eso lo decide quien llama — lo hace `CheckoutPanel`. Este
 * valor por defecto es la red que garantiza que el campo nunca viaje vacío.
 *
 * La forma es distinta a la de las órdenes —una clave plana, no un id por línea anidada—, y esa
 * es la razón de que el transporte diferido no acuñe claves por su cuenta: no hay una regla
 * genérica que valga para las dos.
 */
export function withRequestId(
  payload: CreatePaymentPayload,
): CreatePaymentPayload & { clientRequestId: string } {
  return { ...payload, clientRequestId: payload.clientRequestId ?? newClientId() };
}

export const paymentsApi = {
  summary: (orderId: string) => api.get<PaymentSummary>(`/orders/${orderId}/payments`),
  addPayment: (orderId: string, payload: CreatePaymentPayload) =>
    api.post<PaymentSummary>(`/orders/${orderId}/payments`, withRequestId(payload)),
  setTip: (orderId: string, tipAmount: number) =>
    api.patch<Order>(`/orders/${orderId}/tip`, { tipAmount }),
};
