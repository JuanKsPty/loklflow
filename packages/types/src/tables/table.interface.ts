import type { Sector } from './sector.interface';

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';

export const TABLE_STATUSES: TableStatus[] = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'maintenance',
];

export type TableShape = 'square' | 'round';

export const TABLE_SHAPES: TableShape[] = ['square', 'round'];

export interface RestaurantTable {
  id: string;
  number: number;
  sectorId: string;
  sector?: Sector | null;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  positionX: number | null;
  positionY: number | null;
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
  shape?: TableShape;
  positionX?: number;
  positionY?: number;
  isActive?: boolean;
}

export type UpdateTablePayload = Partial<CreateTablePayload>;

export interface UpdateTableStatusPayload {
  status: TableStatus;
}

export interface BulkCreateTablePayload {
  sectorId: string;
  count: number;
  capacity?: number;
  shape?: TableShape;
}

export interface LayoutPosition {
  id: string;
  positionX: number;
  positionY: number;
  shape?: TableShape;
}

export interface SaveLayoutPayload {
  positions: LayoutPosition[];
}
