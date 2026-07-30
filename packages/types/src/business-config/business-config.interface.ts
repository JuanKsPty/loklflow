export interface BusinessConfig {
  id: string;
  businessName: string;
  logoUrl: string | null;
  timezone: string;
  phone: string | null;
  address: string | null;
  currency: string;
  email: string | null;
  /** Identificación fiscal (RFC, NIT, RUC…). */
  taxId: string | null;
  /** Tasa de impuesto en porcentaje, ya incluida en los precios del menú. */
  taxRate: number;
  receiptFooter: string | null;
}

/**
 * Desglosa el impuesto contenido en un importe que ya lo incluye.
 * Los precios del menú son finales, así que en el recibo el impuesto es informativo:
 * base = total / (1 + tasa), impuesto = total − base.
 */
export function taxBreakdown(
  total: number | string | null | undefined,
  taxRate: number | string | null | undefined,
): { base: number; tax: number } {
  const gross = Number(total) || 0;
  const rate = Number(taxRate) || 0;
  if (rate <= 0) return { base: Number(gross.toFixed(2)), tax: 0 };
  const base = gross / (1 + rate / 100);
  return {
    base: Number(base.toFixed(2)),
    tax: Number((gross - base).toFixed(2)),
  };
}
