const UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Convierte una duración de las que acepta jsonwebtoken (`'15m'`, `'4h'`, `'7d'`) a
 * milisegundos.
 *
 * Existe porque la caducidad del token se declaraba en tres sitios que podían no coincidir:
 * la firma del JWT leía `JWT_REFRESH_EXPIRES_IN`, mientras el `maxAge` de la cookie y el
 * `expiresAt` de la fila en `refresh_tokens` tenían siete días escritos a mano. Cambiar la
 * variable dejaba un token que caduca antes que su cookie, o una fila que sigue viva después.
 *
 * Falla en lugar de adivinar: un formato desconocido revienta al arrancar, que es cuando se
 * puede corregir, en vez de producir sesiones con una duración que nadie pretendía.
 */
export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Duración inválida: "${value}". Se espera un número seguido de s, m, h o d (por ejemplo 15m, 4h, 7d).`,
    );
  }
  return Number(match[1]) * UNITS[match[2]];
}
