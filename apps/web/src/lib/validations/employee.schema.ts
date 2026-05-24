import { z } from 'zod';

export const employeeSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN debe tener 4-6 dígitos').optional().or(z.literal('')),
  roleId: z.string().uuid('Rol requerido'),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
