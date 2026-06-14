/** Formatea un valor monetario. Coerce defensivo porque los `decimal` pueden llegar como string. */
export function formatPrice(value: number | string): string {
  const n = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Tiempo relativo en español ("ahora", "hace 5 min", "hace 2 h", "hace 3 d"). */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
