import { DataSource, type DataSourceOptions } from 'typeorm';
import { databaseOptions } from '../src/config/database.config';
import { TEST_DATABASE, withDatabase } from './env';

/**
 * Opciones de conexión apuntando a `database`. Reescribe la URL además del campo
 * `database` porque TypeORM ignora `database` cuando hay `url`.
 */
export function optionsFor(database: string): DataSourceOptions {
  const base = databaseOptions();
  const url = 'url' in base && base.url ? withDatabase(base.url, database) : undefined;
  return { ...base, database, ...(url ? { url } : {}) } as DataSourceOptions;
}

/**
 * Crea la base de pruebas si no existe, conectándose a `postgres` — no se puede crear una
 * base estando conectado a ella. `CREATE DATABASE` no admite `IF NOT EXISTS`, así que se
 * consulta `pg_database` primero.
 */
export async function ensureTestDatabase(): Promise<void> {
  const admin = new DataSource({
    ...optionsFor('postgres'),
    entities: [],
    migrations: [],
    synchronize: false,
  } as DataSourceOptions);

  await admin.initialize();
  try {
    const rows = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DATABASE,
    ]);
    if (rows.length === 0) {
      // Sin parámetros: CREATE DATABASE no los acepta. TEST_DATABASE no viene de una
      // petición, sale de una constante o de TEST_DATABASE_NAME.
      await admin.query(`CREATE DATABASE "${TEST_DATABASE}"`);
    }
  } finally {
    await admin.destroy();
  }
}

/** Tablas que guardan la operación del día y que cada suite puede querer vaciar. */
const TRANSACTIONAL_TABLES = [
  'order_item_modifiers',
  'order_items',
  'order_status_history',
  'payments',
  'discounts',
  'orders',
  'shifts',
  'notifications',
  'audit_logs',
  'reservations',
];

/**
 * Vacía la operación (órdenes, pagos, turnos…) y deja intacto el catálogo que siembra el
 * seed: usuarios, roles, permisos, productos y mesas. Así cada suite parte de un estado
 * conocido sin tener que volver a sembrar.
 *
 * `CASCADE` evita tener que acertar el orden de las claves ajenas, y `RESTART IDENTITY`
 * reinicia las secuencias para que los números de orden no dependan de la ejecución
 * anterior.
 */
export async function resetOperationalData(ds: DataSource): Promise<void> {
  await ds.query(
    `TRUNCATE TABLE ${TRANSACTIONAL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  // Las mesas quedan como las dejó la última orden; devolverlas a 'available' es parte del
  // estado conocido, porque varias comprobaciones miran si una mesa se liberó.
  await ds.query(`UPDATE "tables" SET status = 'available'`);
}

/** Todas las tablas del esquema público menos el registro de migraciones. */
export async function truncateEverything(ds: DataSource): Promise<void> {
  const rows: { tablename: string }[] = await ds.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await ds.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
