import type { RestaurantTable } from './table.interface';

export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';

export const RESERVATION_STATUSES: ReservationStatus[] = [
  'pending',
  'confirmed',
  'seated',
  'cancelled',
  'no_show',
];

export interface Reservation {
  id: string;
  tableId: string;
  table?: RestaurantTable | null;
  customerName: string;
  customerPhone: string | null;
  partySize: number;
  reservedAt: string;
  notes: string | null;
  status: ReservationStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationPayload {
  tableId: string;
  customerName: string;
  customerPhone?: string;
  partySize: number;
  reservedAt: string;
  notes?: string;
  status?: ReservationStatus;
}

export type UpdateReservationPayload = Partial<CreateReservationPayload>;
