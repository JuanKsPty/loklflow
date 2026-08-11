import type { RestaurantTable } from '../tables/table.interface';
import type { Product } from '../menu/product.interface';
import type { ModifierOption } from '../menu/modifier.interface';
import type { Payment } from '../payments/payment.interface';
import type { OrderItemStatus, OrderSource, OrderStatus } from './order-status';

export interface OrderItemModifier {
  id: string;
  modifierOptionId: string;
  /** La relación es eager en el backend, así que siempre viaja en la respuesta. */
  modifierOption?: ModifierOption;
  priceAdjustment: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
  status: OrderItemStatus;
  modifiers?: OrderItemModifier[];
  createdAt: string;
}

export interface OrderStatusHistory {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string | null;
  changedAt: string;
  /**
   * Hora a la que el cambio ocurrió en el salón, cuando el dispositivo la reportó; `null`
   * en todo lo registrado en línea. Léase siempre como `occurredAt ?? changedAt`.
   */
  occurredAt: string | null;
  notes: string | null;
}

export interface Order {
  id: string;
  orderNumber: number;
  label: string | null;
  tableId: string | null;
  table?: RestaurantTable | null;
  waiterId: string | null;
  shiftId: string | null;
  source: OrderSource;
  status: OrderStatus;
  notes: string | null;
  subtotal: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  mergedIntoOrderId: string | null;
  /** Hora de apertura en el salón; `null` en todo lo creado en línea. Ver `OrderStatusHistory`. */
  occurredAt: string | null;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  payments?: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemPayload {
  /** uuid generado en el dispositivo; ver `CreateOrderPayload.id`. */
  id?: string;
  productId: string;
  quantity: number;
  notes?: string;
  modifierOptionIds?: string[];
  /**
   * Hora a la que la acción ocurrió en el salón. La pone la cola sin conexión al reenviar;
   * las llamadas en línea la omiten y el servidor usa la suya.
   */
  occurredAt?: string;
}

export interface CreateOrderPayload {
  /**
   * uuid generado en el dispositivo, que pasa a ser la clave primaria de la orden.
   *
   * Permite abrir una cuenta sin conexión y encolar operaciones contra ella antes de que el
   * servidor la conozca, sin reescribir identificadores al sincronizar. Y hace la creación
   * idempotente: reenviar la misma petición devuelve la orden que ya existe.
   */
  id?: string;
  tableId?: string;
  label?: string;
  source?: OrderSource;
  notes?: string;
  /**
   * Hora a la que la acción ocurrió en el salón. La pone la cola sin conexión al reenviar;
   * las llamadas en línea la omiten y el servidor usa la suya.
   */
  occurredAt?: string;
  items: CreateOrderItemPayload[];
}

export interface UpdateOrderItemPayload {
  quantity?: number;
  notes?: string;
  /**
   * Hora a la que la acción ocurrió en el salón. La pone la cola sin conexión al reenviar;
   * las llamadas en línea la omiten y el servidor usa la suya.
   */
  occurredAt?: string;
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus;
  notes?: string;
  /**
   * Hora a la que la acción ocurrió en el salón. La pone la cola sin conexión al reenviar;
   * las llamadas en línea la omiten y el servidor usa la suya.
   */
  occurredAt?: string;
}

export interface UpdateOrderItemStatusPayload {
  status: OrderItemStatus;
  /**
   * Hora a la que la acción ocurrió en el salón. La pone la cola sin conexión al reenviar;
   * las llamadas en línea la omiten y el servidor usa la suya.
   */
  occurredAt?: string;
}
