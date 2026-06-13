export interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  isRequired: boolean;
  allowMultiple: boolean;
  minSelections: number;
  maxSelections: number | null;
  options?: ModifierOption[];
  createdAt: string;
  updatedAt: string;
}

export interface ModifierOptionPayload {
  name: string;
  priceAdjustment?: number;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateModifierPayload {
  name: string;
  isRequired?: boolean;
  allowMultiple?: boolean;
  minSelections?: number;
  maxSelections?: number | null;
  options?: ModifierOptionPayload[];
}

export type UpdateModifierPayload = Partial<CreateModifierPayload>;
