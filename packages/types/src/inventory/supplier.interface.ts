export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierPayload {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;
