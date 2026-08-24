import { api } from './client';
import type {
  CreateIngredientPayload,
  ProductStock,
  SetStockPayload,
  CreateMovementPayload,
  CreateSupplierPayload,
  Ingredient,
  RecipeIngredient,
  SetRecipePayload,
  StockMovement,
  Supplier,
  UpdateIngredientPayload,
  UpdateSupplierPayload,
} from '@loklflow/types';

export const inventoryApi = {
  /**
   * Existencias por producto. Por debajo son ingredientes espejo, pero eso no sale de la API:
   * aquí el producto **es** la unidad que se cuenta.
   */
  productStock: {
    list: (query = '') => api.get<ProductStock[]>(`/inventory/products${query}`),
    // PUT: «el stock ahora es N» es idempotente por su propia forma, así que reenviarlo desde una
    // conexión mala deja el mismo número en vez de dos ajustes acumulados.
    set: (productId: string, payload: SetStockPayload) =>
      api.put<ProductStock>(`/inventory/products/${productId}/stock`, payload),
    untrack: (productId: string) =>
      api.delete<ProductStock>(`/inventory/products/${productId}/stock`),
  },

  suppliers: {
    list: () => api.get<Supplier[]>('/inventory/suppliers'),
    get: (id: string) => api.get<Supplier>(`/inventory/suppliers/${id}`),
    create: (payload: CreateSupplierPayload) =>
      api.post<Supplier>('/inventory/suppliers', payload),
    update: (id: string, payload: UpdateSupplierPayload) =>
      api.patch<Supplier>(`/inventory/suppliers/${id}`, payload),
    // Baja lógica: el proveedor está referenciado por las entradas de mercancía que trajo.
    deactivate: (id: string) => api.patch<Supplier>(`/inventory/suppliers/${id}/deactivate`),
  },

  ingredients: {
    list: () => api.get<Ingredient[]>('/inventory/ingredients'),
    // `lowStock()` vivió aquí sin que nadie la llamara. Las pantallas que lo necesitan son Server
    // Components y piden `?lowStock=true` por `serverFetch`, así que el envoltorio de cliente era
    // documentación con forma de código — la que se queda vieja sin que nada se rompa.
    get: (id: string) => api.get<Ingredient>(`/inventory/ingredients/${id}`),
    create: (payload: CreateIngredientPayload) =>
      api.post<Ingredient>('/inventory/ingredients', payload),
    update: (id: string, payload: UpdateIngredientPayload) =>
      api.patch<Ingredient>(`/inventory/ingredients/${id}`, payload),
    deactivate: (id: string) => api.patch<Ingredient>(`/inventory/ingredients/${id}/deactivate`),
  },

  recipes: {
    get: (productId: string) => api.get<RecipeIngredient[]>(`/inventory/recipes/${productId}`),
    // PUT: la receta se reemplaza entera desde la ficha del producto.
    set: (productId: string, payload: SetRecipePayload) =>
      api.put<RecipeIngredient[]>(`/inventory/recipes/${productId}`, payload),
  },

  movements: {
    list: (ingredientId?: string) =>
      api.get<StockMovement[]>(
        ingredientId ? `/inventory/movements?ingredientId=${ingredientId}` : '/inventory/movements',
      ),
    create: (payload: CreateMovementPayload) =>
      api.post<StockMovement>('/inventory/movements', payload),
  },
};
