import { api } from './client';
import type { AuthUser } from '@loklflow/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface PinLoginPayload {
  userId: string;
  pin: string;
}

export const authApi = {
  login: (payload: LoginPayload) => api.post<AuthUser>('/auth/login', payload),
  pinLogin: (payload: PinLoginPayload) => api.post<AuthUser>('/auth/pin', payload),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<AuthUser>('/auth/me'),
};
