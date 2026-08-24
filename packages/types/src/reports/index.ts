import type { PaymentMethod } from '../payments/payment.interface';

/** Un corte de las ventas consumadas: cuántas, cuánto y a cómo salió cada una. */
export interface SalesSlice {
  orders: number;
  total: number;
  averageTicket: number;
}

export interface SalesSummary {
  from: string;
  to: string;
  /** Ventas cobradas en el rango: suma de los pagos registrados. */
  totalSales: number;
  paymentsCount: number;
  byMethod: Record<PaymentMethod, number>;
  /**
   * **Cuentas** cerradas: mesa y pedido por QR. El mostrador va aparte, en `counter`.
   *
   * Una cuenta de mesa —una familia consumiendo una hora— y una venta de mostrador —una botella—
   * no son la misma unidad, así que promediarlas produce un número que no describe a ninguna. Lo
   * que **no** divide por orden (`totalSales`, los productos más vendidos, las ventas por día) sí
   * las suma juntas: ahí mezclar es correcto.
   */
  ordersClosed: number;
  averageTicket: number;
  /** Las ventas de mostrador, con su propio promedio. */
  counter: SalesSlice;
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
