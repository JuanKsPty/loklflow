import { api } from './client';
import type {
  Sector,
  CreateSectorPayload,
  UpdateSectorPayload,
  RestaurantTable,
  CreateTablePayload,
  UpdateTablePayload,
  BulkCreateTablePayload,
  TableStatus,
  SaveLayoutPayload,
  Reservation,
  CreateReservationPayload,
  UpdateReservationPayload,
} from '@loklflow/types';

export const sectorsApi = {
  getAll: () => api.get<Sector[]>('/tables/sectors'),
  getOne: (id: string) => api.get<Sector>(`/tables/sectors/${id}`),
  create: (payload: CreateSectorPayload) => api.post<Sector>('/tables/sectors', payload),
  update: (id: string, payload: UpdateSectorPayload) =>
    api.patch<Sector>(`/tables/sectors/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/tables/sectors/${id}`),
};

export const tablesApi = {
  getAll: () => api.get<RestaurantTable[]>('/tables'),
  getOne: (id: string) => api.get<RestaurantTable>(`/tables/${id}`),
  create: (payload: CreateTablePayload) => api.post<RestaurantTable>('/tables', payload),
  createMany: (payload: BulkCreateTablePayload) =>
    api.post<RestaurantTable[]>('/tables/bulk', payload),
  update: (id: string, payload: UpdateTablePayload) =>
    api.patch<RestaurantTable>(`/tables/${id}`, payload),
  updateStatus: (id: string, status: TableStatus) =>
    api.patch<RestaurantTable>(`/tables/${id}/status`, { status }),
  saveLayout: (payload: SaveLayoutPayload) =>
    api.patch<RestaurantTable[]>('/tables/layout', payload),
  remove: (id: string) => api.delete<void>(`/tables/${id}`),
};

export const reservationsApi = {
  getAll: () => api.get<Reservation[]>('/tables/reservations'),
  getOne: (id: string) => api.get<Reservation>(`/tables/reservations/${id}`),
  create: (payload: CreateReservationPayload) =>
    api.post<Reservation>('/tables/reservations', payload),
  update: (id: string, payload: UpdateReservationPayload) =>
    api.patch<Reservation>(`/tables/reservations/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/tables/reservations/${id}`),
};
