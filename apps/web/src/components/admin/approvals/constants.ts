import type { DiscountStatus } from '@loklflow/types';

/** Fórmula de color del repo: border-X/30 bg-X/10 text-X. */
export const DISCOUNT_STATUS_BADGE: Record<DiscountStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  approved: 'border-success/30 bg-success/10 text-success',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
};
