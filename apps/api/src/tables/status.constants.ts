// Estados definidos localmente para mantener el backend autocontenido (sin importar
// @loklflow/types en tiempo de compilación, lo que alteraría el outDir de nest).
export const TABLE_STATUSES = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'maintenance',
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'seated',
  'cancelled',
  'no_show',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
