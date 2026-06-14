import type { RestaurantTable } from '../tables/table.interface';
import type { Product } from '../menu/product.interface';
import type { OrderItemStatus, OrderSource, OrderStatus } from './order-status';

export interface OrderItemModifier {
  id: string;
  modifierOptionId: string;
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
  notes: string | null;
}

export interface Order {
  id: string;
  orderNumber: number;
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
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemPayload {
  productId: string;
  quantity: number;
  notes?: string;
  modifierOptionIds?: string[];
}

export interface CreateOrderPayload {
  tableId?: string;
  source?: OrderSource;
  notes?: string;
  items: CreateOrderItemPayload[];
}

export interface UpdateOrderItemPayload {
  quantity?: number;
  notes?: string;
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus;
  notes?: string;
}

export interface UpdateOrderItemStatusPayload {
  status: OrderItemStatus;
}
