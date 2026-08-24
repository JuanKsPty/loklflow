import type { Order } from './order.interface';
import type { PaymentMethod, PaymentSummary } from '../payments';

export interface QuickSaleItemPayload {
  productId: string;
  quantity: number;
  notes?: string;
}

/**
 * Una venta de mostrador: crear, cobrar y cerrar en una sola petición.
 *
 * `id` es **obligatorio** —a diferencia de `POST /orders`— porque es lo único que hace la
 * operación reintentable: sin él, un reenvío cobra dos veces. Y no lleva importe: lo calcula el
 * servidor con el precio actual del catálogo, para que una pantalla con precios viejos no
 * descuadre el arqueo.
 */
export interface QuickSalePayload {
  id: string;
  clientRequestId?: string;
  label?: string;
  occurredAt?: string;
  items: QuickSaleItemPayload[];
  payment: { method: PaymentMethod; reference?: string };
}

export interface QuickSaleResult {
  order: Order;
  payment: PaymentSummary;
}
