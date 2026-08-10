import type { IngredientUnit } from './inventory.constants';

export interface Ingredient {
  id: string;
  name: string;
  unit: IngredientUnit;
  currentStock: number;
  minimumStock: number;
  costPerUnit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIngredientPayload {
  name: string;
  unit: IngredientUnit;
  /** Se registra como un ajuste, no se escribe en la columna. */
  initialStock?: number;
  minimumStock?: number;
  costPerUnit?: number;
  isActive?: boolean;
}

/** `initialStock` no está: el stock se mueve, nunca se edita. */
export type UpdateIngredientPayload = Partial<Omit<CreateIngredientPayload, 'initialStock'>>;
