import type { PaymentMethod } from '../payments/payment.interface';

export type ShiftStatus = 'open' | 'closed';

export const SHIFT_STATUSES: ShiftStatus[] = ['open', 'closed'];

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  open: 'Abierto',
  closed: 'Cerrado',
};

export interface Shift {
  id: string;
  openedBy: string;
  closedBy: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  totalSales: number;
  status: ShiftStatus;
  notes: string | null;
}

export interface ShiftSummary {
  shift: Shift;
  byMethod: Record<PaymentMethod, number>;
  totalSales: number;
  cashSales: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  paymentsCount: number;
}

export interface OpenShiftPayload {
  openingCash: number;
  notes?: string;
}

export interface CloseShiftPayload {
  closingCash: number;
  notes?: string;
}
