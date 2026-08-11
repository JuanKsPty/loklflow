import type { OrderItemStatus, OrderStatus } from '@loklflow/types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Lista',
  delivered: 'Entregada',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'border-warning/30 bg-warning/10 text-warning',
  preparing: 'border-primary/30 bg-primary/10 text-primary',
  ready: 'border-success/30 bg-success/10 text-success',
  delivered: 'border-info/30 bg-info/10 text-info',
  closed: 'border-border bg-muted text-muted-foreground',
  cancelled: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Lista',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};

/** Transiciones permitidas (espejo del backend) para mostrar los botones de avance. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};
