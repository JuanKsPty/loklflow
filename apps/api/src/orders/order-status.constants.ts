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

export const ORDER_SOURCES = ['staff', 'customer_qr', 'counter'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

/**
 * Los orígenes que `POST /orders` acepta **en el cuerpo**.
 *
 * `counter` no está, y esa omisión es la mitad del valor del valor nuevo: si se pudiera pedir desde
 * `POST /orders`, cualquiera con `orders:create` —un mesero— podría marcar una comanda normal como
 * venta de mostrador y hacerla desaparecer del tablero de cocina **sin cobrarla**. Lo escribe
 * únicamente el endpoint de venta rápida, que además la cobra en el mismo acto.
 */
export const CREATABLE_ORDER_SOURCES = ['staff', 'customer_qr'] as const;

// Transiciones permitidas del estado de la orden.
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};
