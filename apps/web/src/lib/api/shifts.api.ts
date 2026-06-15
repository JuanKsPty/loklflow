import { api } from './client';
import type {
  CloseShiftPayload,
  OpenShiftPayload,
  Shift,
  ShiftSummary,
} from '@loklflow/types';

export const shiftsApi = {
  current: () => api.get<ShiftSummary | null>('/shifts/current'),
  list: () => api.get<Shift[]>('/shifts'),
  summary: (shiftId: string) => api.get<ShiftSummary>(`/shifts/${shiftId}/summary`),
  open: (payload: OpenShiftPayload) => api.post<ShiftSummary>('/shifts/open', payload),
  close: (shiftId: string, payload: CloseShiftPayload) =>
    api.post<ShiftSummary>(`/shifts/${shiftId}/close`, payload),
};
