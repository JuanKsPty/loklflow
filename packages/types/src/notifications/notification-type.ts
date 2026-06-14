export type NotificationType =
  | 'order_new'
  | 'order_ready'
  | 'discount_pending'
  | 'stock_alert'
  | 'table_ready_to_pay';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'order_new',
  'order_ready',
  'discount_pending',
  'stock_alert',
  'table_ready_to_pay',
];
