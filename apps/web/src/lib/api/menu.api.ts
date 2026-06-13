import { api } from './client';
import type {
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  Modifier,
  CreateModifierPayload,
  UpdateModifierPayload,
  Combo,
  CreateComboPayload,
  UpdateComboPayload,
} from '@loklflow/types';

export const categoriesApi = {
  getAll: () => api.get<Category[]>('/menu/categories'),
  getOne: (id: string) => api.get<Category>(`/menu/categories/${id}`),
  create: (payload: CreateCategoryPayload) => api.post<Category>('/menu/categories', payload),
  update: (id: string, payload: UpdateCategoryPayload) =>
    api.patch<Category>(`/menu/categories/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/menu/categories/${id}`),
};

export const productsApi = {
  getAll: () => api.get<Product[]>('/menu/products'),
  getOne: (id: string) => api.get<Product>(`/menu/products/${id}`),
  create: (payload: CreateProductPayload) => api.post<Product>('/menu/products', payload),
  update: (id: string, payload: UpdateProductPayload) =>
    api.patch<Product>(`/menu/products/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/menu/products/${id}`),
};

export const modifiersApi = {
  getAll: () => api.get<Modifier[]>('/menu/modifiers'),
  getOne: (id: string) => api.get<Modifier>(`/menu/modifiers/${id}`),
  create: (payload: CreateModifierPayload) => api.post<Modifier>('/menu/modifiers', payload),
  update: (id: string, payload: UpdateModifierPayload) =>
    api.patch<Modifier>(`/menu/modifiers/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/menu/modifiers/${id}`),
};

export const combosApi = {
  getAll: () => api.get<Combo[]>('/menu/combos'),
  getOne: (id: string) => api.get<Combo>(`/menu/combos/${id}`),
  create: (payload: CreateComboPayload) => api.post<Combo>('/menu/combos', payload),
  update: (id: string, payload: UpdateComboPayload) =>
    api.patch<Combo>(`/menu/combos/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/menu/combos/${id}`),
};
