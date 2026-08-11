import { api } from './client';
import type {
  CreateIngredientPayload,
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
