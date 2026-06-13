export interface Sector {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSectorPayload {
  name: string;
  description?: string;
  isActive?: boolean;
}

export type UpdateSectorPayload = Partial<CreateSectorPayload>;
