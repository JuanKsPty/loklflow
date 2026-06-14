export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'closed'
  | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'preparing',
  'ready',
  'delivered',
  'closed',
  'cancelled',
];

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export const ORDER_ITEM_STATUSES: OrderItemStatus[] = [
  'pending',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
];

export type OrderSource = 'staff' | 'customer_qr';

export const ORDER_SOURCES: OrderSource[] = ['staff', 'customer_qr'];
