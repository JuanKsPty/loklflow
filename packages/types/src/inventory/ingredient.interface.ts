import type { IngredientUnit } from './inventory.constants';

export interface Ingredient {
  id: string;
  name: string;
  /**
   * Con valor, este ingrediente **es** las existencias de ese producto y no un insumo del
   * catálogo. Las pantallas de insumos y el editor de recetas no lo ven; tiene la suya.
   */
  productId: string | null;
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
