import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().uuid('Selecciona un producto'),
  quantity: z.number().int().min(1),
  notes: z.string().optional().or(z.literal('')),
  modifierOptionIds: z.array(z.string().uuid()),
});

export const orderSchema = z.object({
  tableId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  items: z.array(orderItemSchema).min(1, 'Agrega al menos un ítem'),
});

export type OrderFormValues = z.infer<typeof orderSchema>;
