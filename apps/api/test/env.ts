import { loadRootEnv } from '../src/config/load-root-env';

/** Base de datos que usan los tests de integración. Nunca la de desarrollo. */
export const TEST_DATABASE = process.env.TEST_DATABASE_NAME ?? 'loklflow_test';

/**
 * Apunta la conexión a la base de pruebas **antes** de que se importe cualquier módulo de
 * Nest, y fija `NODE_ENV=test`.
 *
 * Dos detalles que hacen que esto funcione, y sin los cuales la suite escribiría en la
 * base de desarrollo:
 *
 * 1. `DATABASE_URL` tiene precedencia sobre las variables sueltas, así que hay que
 *    reescribir la base **dentro de la propia URL**. Cambiar solo `DATABASE_NAME` no
 *    tendría ningún efecto.
 * 2. Ni dotenv ni `ConfigModule` sobrescriben una variable que ya esté en `process.env`.
 *    Por eso se asigna aquí primero y por eso este módulo tiene que cargarse antes que
 *    `AppModule` — de ahí el `setupFiles` de la configuración de Jest.
 *
 * `NODE_ENV=test` además apaga `synchronize`: el esquema tiene que venir de las
 * migraciones, que es justo una de las cosas que la suite comprueba.
 */
export function useTestDatabase(): void {
  loadRootEnv();

  process.env.NODE_ENV = 'test';

  // Zona horaria del negocio, no la del runner. Los runners de CI corren en UTC, donde un
  // desfase entre la hora local del proceso y el UTC que guarda Postgres es invisible: fue
  // así como el filtro por rango de fechas de los reportes llegó a producción descartando
  // las filas de la última madrugada. Con esto la suite corre siempre desplazada respecto
  // a UTC, igual que el servidor de un restaurante.
  process.env.TZ = process.env.TZ ?? 'America/Mexico_City';

  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = withDatabase(process.env.DATABASE_URL, TEST_DATABASE);
  }
  process.env.DATABASE_NAME = TEST_DATABASE;

  // La API se niega a arrancar sin secretos reales. En CI los inyecta el workflow; en
  // local se toman del .env, y si no hay se generan al vuelo para que la suite corra
  // igual en un clon recién hecho.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-this')) {
    process.env.JWT_SECRET = 'test-only-secret-not-used-outside-jest-000000000000';
  }
  if (
    !process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_REFRESH_SECRET.startsWith('change-this')
  ) {
    process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret-not-used-outside-jest-0000';
  }
}

/** Devuelve la misma URL de conexión apuntando a otra base de datos. */
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}
