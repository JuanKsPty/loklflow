export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'digital_wallet';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'digital_wallet'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  digital_wallet: 'Billetera digital',
};

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  processedBy: string | null;
  processedAt: string;
}

export interface PaymentSummary {
  total: number;
  paid: number;
  remaining: number;
  payments: Payment[];
}

export interface CreatePaymentPayload {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  /**
   * Clave de idempotencia del dispositivo: reenviar el mismo pago devuelve el estado de la
   * cuenta en lugar de cobrar otra vez. Sin ella, un pago parcial repetido suma dos veces,
   * porque el importe sigue cabiendo en lo que resta y ninguna validación lo frena.
   */
  clientRequestId?: string;
}
