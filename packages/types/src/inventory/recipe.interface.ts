import type { Ingredient } from './ingredient.interface';

export interface RecipeIngredient {
  id: string;
  productId: string;
  ingredientId: string;
  quantity: number;
  ingredient?: Ingredient;
}

export interface RecipeLinePayload {
  ingredientId: string;
  quantity: number;
}

/** La receta se reemplaza entera; una lista vacía deja el producto sin receta. */
export interface SetRecipePayload {
  lines: RecipeLinePayload[];
}
