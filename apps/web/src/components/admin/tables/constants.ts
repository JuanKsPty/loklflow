import type { ReservationStatus, TableShape, TableStatus } from '@loklflow/types';

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  available: 'Disponible',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  cleaning: 'Limpieza',
  maintenance: 'Mantenimiento',
};

/** Clases tailwind para la tarjeta de mesa en el mapa, por estado. */
export const TABLE_STATUS_MAP_CLASSES: Record<TableStatus, string> = {
  available: 'border-success/40 bg-success/10 text-success hover:bg-success/20',
  occupied: 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20',
  reserved: 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20',
  cleaning: 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20',
  maintenance: 'border-muted-foreground/40 bg-muted text-muted-foreground hover:bg-muted/80',
};

export const TABLE_SHAPE_LABELS: Record<TableShape, string> = {
  square: 'Cuadrada',
  round: 'Redonda',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  seated: 'Sentada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
};
