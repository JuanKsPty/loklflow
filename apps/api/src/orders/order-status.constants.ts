// Estados definidos localmente para mantener el backend autocontenido (sin importar
// @loklflow/types en compilación, lo que alteraría el outDir de nest).
export const ORDER_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'delivered',
  'closed',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const ORDER_SOURCES = ['staff', 'customer_qr'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

// Transiciones permitidas del estado de la orden.
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};
