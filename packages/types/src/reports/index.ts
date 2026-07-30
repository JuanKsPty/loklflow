import type { PaymentMethod } from '../payments/payment.interface';

export interface SalesSummary {
  from: string;
  to: string;
  /** Ventas cobradas en el rango: suma de los pagos registrados. */
  totalSales: number;
  paymentsCount: number;
  byMethod: Record<PaymentMethod, number>;
  ordersClosed: number;
  averageTicket: number;
  totalDiscounts: number;
  totalTips: number;
  openOrders: number;
  openOrdersValue: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface PrepTimeMetric {
  /** Minutos medios desde que se crea la orden hasta que está lista. */
  averageMinutes: number | null;
  /** Minutos medios entre "en preparación" y "lista". */
  averageKitchenMinutes: number | null;
  sampleSize: number;
}

export interface SalesByDay {
  day: string;
  total: number;
  orders: number;
}
