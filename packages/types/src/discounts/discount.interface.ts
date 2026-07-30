import type { Order } from '../orders/order.interface';

export type DiscountType = 'percentage' | 'fixed';

export const DISCOUNT_TYPES: DiscountType[] = ['percentage', 'fixed'];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Porcentaje',
  fixed: 'Importe fijo',
};

export type DiscountStatus = 'pending' | 'approved' | 'rejected';

export const DISCOUNT_STATUSES: DiscountStatus[] = ['pending', 'approved', 'rejected'];

export const DISCOUNT_STATUS_LABELS: Record<DiscountStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export interface Discount {
  id: string;
  orderId: string;
  order?: Order;
  type: DiscountType;
  /** Porcentaje si type es 'percentage', importe si es 'fixed'. */
  value: number;
  /** Importe resuelto en moneda al momento de la solicitud. */
  amount: number;
  /** Porcentaje equivalente sobre el subtotal. */
  percentage: number;
  reason: string;
  requestedBy: string;
  requestedByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  status: DiscountStatus;
  resolvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}
