// Métodos de pago definidos localmente (sin importar @loklflow/types en compilación).
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'digital_wallet'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
