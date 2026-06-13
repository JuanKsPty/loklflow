import { z } from 'zod';
import { TABLE_STATUSES, RESERVATION_STATUSES } from '@loklflow/types';

export const sectorSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional().or(z.literal('')),
  isActive: z.boolean(),
});
export type SectorFormValues = z.infer<typeof sectorSchema>;

export const tableSchema = z.object({
  number: z.number().int().min(1, 'Número inválido'),
  sectorId: z.string().uuid('Selecciona un sector'),
  capacity: z.number().int().min(1, 'Capacidad inválida'),
  status: z.enum(TABLE_STATUSES as [string, ...string[]]),
  isActive: z.boolean(),
});
export type TableFormValues = z.infer<typeof tableSchema>;

export const reservationSchema = z.object({
  tableId: z.string().uuid('Selecciona una mesa'),
  customerName: z.string().min(2, 'Nombre requerido'),
  customerPhone: z.string().optional().or(z.literal('')),
  partySize: z.number().int().min(1, 'Al menos 1 persona'),
  reservedAt: z.string().min(1, 'Fecha y hora requeridas'),
  notes: z.string().optional().or(z.literal('')),
  status: z.enum(RESERVATION_STATUSES as [string, ...string[]]),
});
export type ReservationFormValues = z.infer<typeof reservationSchema>;
