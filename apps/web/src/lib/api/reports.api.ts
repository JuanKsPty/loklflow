import { api } from './client';
import type {
  PrepTimeMetric,
  SalesByDay,
  SalesSummary,
  TopProduct,
} from '@loklflow/types';

export interface DateRange {
  from?: string;
  to?: string;
}

function qs(range: DateRange = {}): string {
  const p = new URLSearchParams();
  if (range.from) p.set('from', range.from);
  if (range.to) p.set('to', range.to);
  return p.toString() ? `?${p.toString()}` : '';
}

export const reportsApi = {
  salesSummary: (range?: DateRange) =>
    api.get<SalesSummary>(`/reports/sales-summary${qs(range)}`),
  topProducts: (range?: DateRange) =>
    api.get<TopProduct[]>(`/reports/top-products${qs(range)}`),
  prepTimes: (range?: DateRange) => api.get<PrepTimeMetric>(`/reports/prep-times${qs(range)}`),
  salesByDay: (range?: DateRange) => api.get<SalesByDay[]>(`/reports/sales-by-day${qs(range)}`),

  /** Ruta del CSV, para pasarla a `downloadFile`. */
  salesCsvPath: (range?: DateRange) => `/reports/sales.csv${qs(range)}`,
};
