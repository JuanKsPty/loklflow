import { z } from './zod';
import { INGREDIENT_UNITS, MANUAL_MOVEMENT_TYPES } from '@loklflow/types';

export const supplierSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email('Correo inválido'), z.literal('')]).optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
});
export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const ingredientSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  unit: z.enum(INGREDIENT_UNITS),
  initialStock: z.number().min(0, 'No puede ser negativo').optional(),
  minimumStock: z.number().min(0, 'No puede ser negativo').optional(),
  costPerUnit: z.number().min(0, 'No puede ser negativo').optional(),
  isActive: z.boolean(),
});
export type IngredientFormValues = z.infer<typeof ingredientSchema>;

/**
 * El motivo es obligatorio en merma y ajuste, y opcional en una entrada.
 *
 * La misma regla vive en el servidor, que es donde manda: esto solo evita el viaje de ida y
 * vuelta para decir algo que ya se sabe aquí.
 */
export const movementSchema = z
  .object({
    ingredientId: z.string().uuid('Elige un ingrediente'),
    type: z.enum(MANUAL_MOVEMENT_TYPES),
    quantity: z.number().positive('Tiene que ser mayor que cero'),
    direction: z.enum(['increase', 'decrease']).optional(),
    reason: z.string().optional(),
    supplierId: z.string().optional(),
    costPerUnit: z.number().min(0).optional(),
  })
  .refine((v) => v.type === 'entry' || Boolean(v.reason?.trim()), {
    message: 'Una merma o un ajuste necesitan un motivo',
    path: ['reason'],
  });
export type MovementFormValues = z.infer<typeof movementSchema>;
