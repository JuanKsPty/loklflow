/**
 * Cálculo de importes de una orden, en funciones puras y sin dependencias de TypeORM
 * para poder probarlo aislado. TypeORM devuelve las columnas `numeric` de Postgres como
 * string, así que todo entra por Number() antes de operar.
 */

/** Forma mínima que necesita el cálculo; evita acoplar esto a las entidades. */
export interface PricedModifier {
  priceAdjustment: number | string;
}

export interface PricedItem {
  subtotal: number | string;
  status: string;
}

export interface OrderAmounts {
  subtotal: number;
  total: number;
}

/** Redondeo a 2 decimales devolviendo número, no string. */
const money = (n: number): number => Number(n.toFixed(2));

/**
 * Subtotal de una línea: (precio unitario + ajustes de los modificadores) × cantidad.
 * Los ajustes pueden ser negativos.
 */
export function itemSubtotal(
  quantity: number,
  unitPrice: number | string,
  modifiers: PricedModifier[] = [],
): number {
  const adjustments = modifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
  return money((Number(unitPrice) + adjustments) * quantity);
}

/**
 * Importes de la orden. Las líneas canceladas no suman.
 * El descuento resta y la propina suma, ambos sobre el subtotal.
 */
export function computeTotals(
  items: PricedItem[],
  discountAmount: number | string = 0,
  tipAmount: number | string = 0,
): OrderAmounts {
  const active = items.filter((i) => i.status !== 'cancelled');
  const subtotal = money(active.reduce((sum, i) => sum + Number(i.subtotal), 0));
  const discount = Number(discountAmount) || 0;
  const tip = Number(tipAmount) || 0;
  return { subtotal, total: money(subtotal - discount + tip) };
}
