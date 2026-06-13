import type { Category } from './category.interface';
import type { Modifier } from './modifier.interface';

export interface ProductAvailability {
  id: string;
  dayOfWeek: number; // 0 (domingo) – 6 (sábado)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isAvailable: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  category?: Category | null;
  isActive: boolean;
  modifiers?: Modifier[];
  availabilities?: ProductAvailability[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductAvailabilityPayload {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId?: string;
  isActive?: boolean;
  modifierIds?: string[];
  availabilities?: ProductAvailabilityPayload[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;
