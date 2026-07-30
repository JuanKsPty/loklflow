import { api } from './client';
import type { BusinessConfig } from '@loklflow/types';

export type UpdateBusinessConfigPayload = Partial<
  Omit<BusinessConfig, 'id'>
>;

export const businessConfigApi = {
  get: () => api.get<BusinessConfig>('/business-config'),
  update: (payload: UpdateBusinessConfigPayload) =>
    api.put<BusinessConfig>('/business-config', payload),
};
