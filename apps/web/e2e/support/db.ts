import { Client } from 'pg';
import { TRANSACTIONAL_TABLES } from '../../../api/test/transactional-tables';

/**
 * Estado conocido antes de cada prueba, contra la base del e2e.
 *
 * Se conecta con `pg` a pelo en vez de levantar TypeORM: aquí no hay entidades ni repositorios,
 * solo un `TRUNCATE`, y arrastrar el ORM al proceso de Playwright significaría cargar la
 * configuración de Nest entera para ejecutar una consulta.
 *
 * La lista de tablas se **importa** del paquete de la API. Es un monorepo: duplicarla es cómo se
 * acaba truncando nueve tablas en un sitio y diez en el otro.
 *
 * **Nunca un endpoint de reset en la API.** Un `POST /test/reset` existe también en producción
 * por definición, y ninguna cantidad de guardas compensa tener una ruta cuyo trabajo es borrar
 * la base.
 */

export const E2E_DATABASE = process.env.E2E_DATABASE_NAME ?? 'loklflow_e2e';

/** La URL de conexión con la base del e2e sustituida dentro. */
export function e2eDatabaseUrl(): string {
  const base =
    process.env.DATABASE_URL ?? 'postgresql://loklflow:loklflow@localhost:5432/loklflow_db';
  const url = new URL(base);
  url.pathname = `/${E2E_DATABASE}`;
  return url.toString();
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: e2eDatabaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Vacía la operación del día y deja el catálogo del seed intacto: usuarios, roles, permisos,
 * productos y mesas. Lo mismo que hace la suite de integración, por el mismo motivo — volver a
 * sembrar en cada prueba costaría más que la prueba.
 */
export async function resetOperationalData(): Promise<void> {
  const list = TRANSACTIONAL_TABLES.map((t) => `"${t}"`).join(', ');
  await withClient(async (client) => {
    await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    await client.query(`UPDATE "tables" SET status = 'available', status_changed_at = now()`);
  });
}

/** Consulta suelta, para afirmar contra la base lo que la pantalla no enseña. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withClient(async (client) => (await client.query(sql, params)).rows as T[]);
}
