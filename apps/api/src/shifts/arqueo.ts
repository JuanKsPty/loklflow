import { PAYMENT_METHODS, type PaymentMethod } from '../payments/payment-method.constants';

/**
 * La aritmética del arqueo de caja, aparte del servicio.
 *
 * Sale de `ShiftsService.summary`, donde estaba mezclada con dos consultas. Es la misma
 * decisión que `order-totals.ts`: lo que decide si la caja cuadra se prueba con números, no
 * levantando una base de datos, y el redondeo tiene que ser explícito en un sitio donde
 * `0.1 + 0.2` produce diferencias que el cajero acaba pagando de su bolsillo.
 *
 * Los importes llegan como `string | number` porque el driver de Postgres devuelve `numeric`
 * como cadena: convertirlo aquí y no en el llamador es lo que impide que un `+` concatene.
 */

export interface ArqueoInput {
  /** Efectivo con el que se abrió la caja. */
  openingCash: number | string;
  /** Efectivo contado al cerrar. `null` mientras el turno sigue abierto. */
  closingCash: number | string | null;
  /** Un elemento por pago cobrado durante el turno. */
  payments: { method: PaymentMethod; amount: number | string }[];
}

export interface Arqueo {
  byMethod: Record<PaymentMethod, number>;
  totalSales: number;
  cashSales: number;
  /** Lo que debería haber en el cajón: apertura + ventas en efectivo. */
  expectedCash: number;
  countedCash: number | null;
  /** Contado − esperado. Negativo es faltante. `null` hasta que se cuenta. */
  difference: number | null;
  paymentsCount: number;
}

/** Dos decimales, que es la unidad mínima con la que se cobra. */
function money(value: number): number {
  return Number(value.toFixed(2));
}

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export function arqueo(input: ArqueoInput): Arqueo {
  const byMethod = PAYMENT_METHODS.reduce(
    (acc, method) => {
      acc[method] = 0;
      return acc;
    },
    {} as Record<PaymentMethod, number>,
  );

  for (const payment of input.payments) {
    // Se redondea en cada suma y no solo al final: un método con cientos de pagos acumula el
    // error de coma flotante hasta hacerse visible en el desglose que el cajero compara a mano.
    byMethod[payment.method] = money(byMethod[payment.method] + toNumber(payment.amount));
  }

  const totalSales = money(PAYMENT_METHODS.reduce((sum, m) => sum + byMethod[m], 0));
  const cashSales = byMethod.cash;
  const openingCash = toNumber(input.openingCash);
  const expectedCash = money(openingCash + cashSales);
  const countedCash = input.closingCash === null ? null : toNumber(input.closingCash);
  const difference = countedCash === null ? null : money(countedCash - expectedCash);

  return {
    byMethod,
    totalSales,
    cashSales,
    expectedCash,
    countedCash,
    difference,
    paymentsCount: input.payments.length,
  };
}
