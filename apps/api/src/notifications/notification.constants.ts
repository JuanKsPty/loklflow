export const NOTIFICATION_TYPES = [
  'order_new',
  'order_ready',
  'discount_pending',
  'stock_alert',
  'table_ready_to_pay',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
