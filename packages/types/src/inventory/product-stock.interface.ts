import type { IngredientUnit, StockSetReason } from './inventory.constants';
import type { PreparationStation } from '../menu/preparation-station';

/** Una fila de la pantalla de existencias: el producto y lo que queda de él. */
export interface ProductStock {
  productId: string;
  name: string;
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  station: PreparationStation;
  isActive: boolean;
  /** ¿Lleva existencias propias? */
  tracked: boolean;
  ingredientId: string | null;
  /** `null`, **no cero**, cuando no se lleva stock: «no lo cuento» y «tengo cero» son distintos. */
  currentStock: number | null;
  minimumStock: number | null;
  unit: IngredientUnit | null;
  stockUpdatedAt: string | null;
  lowStock: boolean;
  /** Para poder explicar por qué no se le pueden llevar existencias. */
  hasRecipe: boolean;
}

/** «Ahora tengo N.» El delta lo calcula el servidor con la fila bloqueada. */
export interface SetStockPayload {
  newStock: number;
  reasonCode: StockSetReason;
  note?: string;
}
