import type { Ingredient } from './ingredient.interface';
import type { ManualMovementType, StockMovementType } from './inventory.constants';
import type { Supplier } from './supplier.interface';

export interface StockMovement {
  id: string;
  ingredientId: string;
  type: StockMovementType;
  /** Con signo: positivo suma, negativo resta. */
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  supplierId: string | null;
  orderId: string | null;
  createdBy: string;
  createdAt: string;
  ingredient?: Ingredient;
  supplier?: Supplier | null;
}

export interface CreateMovementPayload {
  ingredientId: string;
  type: ManualMovementType;
  /** Siempre positiva. El signo lo decide el tipo. */
  quantity: number;
  direction?: 'increase' | 'decrease';
  reason?: string;
  supplierId?: string;
  costPerUnit?: number;
}
