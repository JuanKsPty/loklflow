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

/**
 * `counter` es la venta de mostrador que el administrador registra desde el panel: sin mesa, ya
 * cobrada. No se puede pedir desde `POST /orders` —la escribe solo el endpoint de venta rápida—
 * porque si no, cualquiera con `orders:create` podría marcar una comanda normal como venta de
 * mostrador y hacerla desaparecer del tablero de cocina sin cobrarla.
 */
export type OrderSource = 'staff' | 'customer_qr' | 'counter';

export const ORDER_SOURCES: OrderSource[] = ['staff', 'customer_qr', 'counter'];

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  staff: 'Personal',
  customer_qr: 'QR del cliente',
  counter: 'Mostrador',
};
