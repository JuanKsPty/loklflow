import { api } from './client';
import type { User, CreateUserPayload, UpdateUserPayload } from '@loklflow/types';

export const usersApi = {
  getAll: () => api.get<User[]>('/users'),
  getOperational: () => api.get<Pick<User, 'id' | 'name' | 'roleName'>[]>('/users/operational'),
  getOne: (id: string) => api.get<User>(`/users/${id}`),
  create: (payload: CreateUserPayload) => api.post<User>('/users', payload),
  update: (id: string, payload: UpdateUserPayload) => api.patch<User>(`/users/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/users/${id}`),
};
