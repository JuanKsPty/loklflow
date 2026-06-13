/** Formatea un valor monetario. Coerce defensivo porque los `decimal` pueden llegar como string. */
export function formatPrice(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
