import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const categorySchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional().or(z.literal('')),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;

export const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'HH:mm'),
  endTime: z.string().regex(timeRegex, 'HH:mm'),
  isAvailable: z.boolean(),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional().or(z.literal('')),
  price: z.number().min(0, 'Precio inválido'),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  station: z.enum(['kitchen', 'bar', 'immediate']),
  isActive: z.boolean(),
  modifierIds: z.array(z.string().uuid()),
  availabilities: z.array(availabilitySchema),
});
export type ProductFormValues = z.infer<typeof productSchema>;

export const modifierOptionSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  priceAdjustment: z.number(),
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
});

export const modifierSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  isRequired: z.boolean(),
  allowMultiple: z.boolean(),
  minSelections: z.number().int().min(0),
  maxSelections: z.number().int().min(1).nullable(),
  options: z.array(modifierOptionSchema).min(1, 'Agrega al menos una opción'),
});
export type ModifierFormValues = z.infer<typeof modifierSchema>;

export const comboItemSchema = z.object({
  productId: z.string().uuid('Selecciona un producto'),
  quantity: z.number().int().min(1),
  allowSubstitution: z.boolean(),
});

export const comboSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional().or(z.literal('')),
  price: z.number().min(0, 'Precio inválido'),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  isActive: z.boolean(),
  items: z.array(comboItemSchema).min(1, 'Agrega al menos un producto'),
});
export type ComboFormValues = z.infer<typeof comboSchema>;
