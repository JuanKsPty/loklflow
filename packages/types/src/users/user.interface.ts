export interface User {
  id: string;
  name: string;
  email: string | null;
  pin: string | null;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email?: string;
  password?: string;
  pin?: string;
  roleId: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  pin?: string;
  roleId?: string;
  isActive?: boolean;
}
