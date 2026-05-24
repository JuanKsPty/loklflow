import { api } from './client';
import type { Role, RoleWithPermissions, Permission } from '@loklflow/types';

export interface CreateRolePayload {
  name: string;
  description?: string;
  maxDiscountPercentage?: number;
}

export const rolesApi = {
  getAll: () => api.get<Role[]>('/roles'),
  getAllPermissions: () => api.get<Permission[]>('/roles/permissions'),
  getOne: (id: string) => api.get<RoleWithPermissions>(`/roles/${id}`),
  create: (payload: CreateRolePayload) => api.post<Role>('/roles', payload),
  update: (id: string, payload: Partial<CreateRolePayload> & { isActive?: boolean }) =>
    api.patch<Role>(`/roles/${id}`, payload),
  assignPermissions: (id: string, permissionIds: string[]) =>
    api.put<RoleWithPermissions>(`/roles/${id}/permissions`, { permissionIds }),
  remove: (id: string) => api.delete<void>(`/roles/${id}`),
};
