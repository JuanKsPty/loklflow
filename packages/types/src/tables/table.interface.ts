import type { Sector } from './sector.interface';

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';

export const TABLE_STATUSES: TableStatus[] = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'maintenance',
];

export interface RestaurantTable {
  id: string;
  number: number;
  sectorId: string;
  sector?: Sector | null;
  capacity: number;
  status: TableStatus;
  qrCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTablePayload {
  number: number;
  sectorId: string;
  capacity: number;
  status?: TableStatus;
  isActive?: boolean;
}

export type UpdateTablePayload = Partial<CreateTablePayload>;

export interface UpdateTableStatusPayload {
  status: TableStatus;
}
