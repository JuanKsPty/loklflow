import { DataSource } from 'typeorm';
import { useTestDatabase, TEST_DATABASE } from './env';
import { ensureTestDatabase, optionsFor, truncateEverything } from './database';
import { runSeeds } from '../src/database/seeds/seed';

/**
 * Prepara la base de pruebas una vez por ejecución.
 *
 * Aplicar las migraciones aquí no es un detalle de fontanería: **es la comprobación de que
 * el esquema se puede levantar desde cero**, que es la garantía que el proyecto no tenía.
 * Si una migración estuviera mal, la suite entera no arranca.
 *
 * Corre en un proceso aparte del de los tests, así que tiene que llamar a `useTestDatabase()`
 * por su cuenta: no hereda lo que hace el `setupFiles`.
 */
export default async function globalSetup(): Promise<void> {
  useTestDatabase();
  await ensureTestDatabase();

  const ds = new DataSource(optionsFor(TEST_DATABASE));
  await ds.initialize();
  try {
    const applied = await ds.runMigrations();
    if (applied.length > 0) {
      console.log(`\n[int] ${applied.length} migraciones aplicadas en ${TEST_DATABASE}`);
    }

    // Estado conocido en cada ejecución: se borra todo y se vuelve a sembrar. Es rápido
    // (el seed son unas decenas de filas) y evita que un test dependa de lo que dejó la
    // corrida anterior.
    await truncateEverything(ds);
    await runSeeds(ds);
  } finally {
    await ds.destroy();
  }
}
