import type { Product } from './product.interface';

export interface ComboItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  allowSubstitution: boolean;
}

export interface Combo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  items?: ComboItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ComboItemPayload {
  productId: string;
  quantity?: number;
  allowSubstitution?: boolean;
}

export interface CreateComboPayload {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isActive?: boolean;
  items?: ComboItemPayload[];
}

export type UpdateComboPayload = Partial<CreateComboPayload>;
