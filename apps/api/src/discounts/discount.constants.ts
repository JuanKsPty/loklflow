// Definidos localmente para mantener el backend autocontenido, igual que
// ORDER_STATUSES en orders/order-status.constants.ts.
export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];

/** Solo un descuento pendiente cuenta como bloqueante; los resueltos son historial. */
export const DISCOUNT_RESOLVED: DiscountStatus[] = ['approved', 'rejected'];
