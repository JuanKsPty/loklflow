/**
 * uuid v4 generado en el dispositivo.
 *
 * Es la clave primaria que viaja al servidor en las órdenes y sus ítems, y la clave de
 * idempotencia de los pagos: reenviar la misma petición devuelve lo que ya existe en lugar de
 * duplicarlo. Sirve tanto para el doble clic de hoy como para la cola sin conexión de la
 * Fase 4, que encolará operaciones contra una orden que el servidor todavía no conoce.
 *
 * `crypto.randomUUID()` **solo existe en contexto seguro** (HTTPS o localhost): sobre `http://`
 * en una IP de LAN es `undefined` y llamarlo reventaría. `crypto.getRandomValues`, en cambio,
 * está disponible siempre, así que el respaldo construye el uuid a mano sin perder calidad
 * criptográfica.
 */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Versión 4 y variante RFC 4122, igual que haría randomUUID.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
