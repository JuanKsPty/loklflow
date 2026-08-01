import { registerAs } from '@nestjs/config';

/**
 * Falla al arrancar si falta un secreto, en lugar de caer en un valor por defecto.
 * Un default aquí es peor que un crash: la app arranca firmando tokens con un
 * secreto que está publicado en el repositorio.
 */
function requireSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y genera un ` +
        `secreto con: openssl rand -base64 48`,
    );
  }
  if (value.startsWith('change-this')) {
    throw new Error(
      `${name} sigue con el valor de ejemplo. Genera uno real con: openssl rand -base64 48`,
    );
  }
  return value;
}

export default registerAs('jwt', () => ({
  secret: requireSecret('JWT_SECRET'),
  expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshSecret: requireSecret('JWT_REFRESH_SECRET'),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  pinExpiresIn: '4h',
  /**
   * Ventana de refresco para las sesiones por PIN, más corta que la de email a propósito:
   * un PIN son cuatro dígitos, así que no conviene que abra una sesión renovable durante
   * una semana. Doce horas cubren un turno con margen.
   *
   * Antes las sesiones por PIN no recibían ningún token de refresco, así que a las cuatro
   * horas exactas el mesero o el cajero quedaban fuera a mitad de servicio.
   */
  pinRefreshExpiresIn: process.env.JWT_PIN_REFRESH_EXPIRES_IN ?? '12h',
}));
