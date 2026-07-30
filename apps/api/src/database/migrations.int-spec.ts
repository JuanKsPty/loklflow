import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { closeTestApp, createTestApp } from '../../test/app';
import { runSeeds } from './seeds/seed';

/**
 * El esquema de esta base lo levantaron **las migraciones**, no `synchronize`: el arranque
 * de la suite corre con `NODE_ENV=test`. Que estos casos pasen es la prueba de que el
 * proyecto se puede desplegar en una base vacía, que es lo que hasta ahora nadie
 * comprobaba: en desarrollo `synchronize` tapaba cualquier migración incompleta.
 */
describe('Migraciones y seed', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('no deja ninguna migración pendiente', async () => {
    // Si una migración quedara sin aplicar, cualquier despliegue arrancaría con el esquema
    // a medias.
    await expect(ds.showMigrations()).resolves.toBe(false);
  });

  it('registra en la tabla `migrations` todas las que hay en disco', async () => {
    const [{ count }]: { count: string }[] = await ds.query('SELECT count(*) FROM migrations');
    expect(Number(count)).toBe(ds.migrations.length);
    expect(ds.migrations.length).toBeGreaterThanOrEqual(4);
  });

  it('volver a correrlas no aplica nada', async () => {
    const applied = await ds.runMigrations();
    expect(applied).toEqual([]);
  });

  it('creó las tablas del modelo, no solo las que toca el código de arranque', async () => {
    const rows: { tablename: string }[] = await ds.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const tables = rows.map((r) => r.tablename);

    for (const t of [
      'users',
      'roles',
      'permissions',
      'role_permissions',
      'orders',
      'order_items',
      'order_status_history',
      'payments',
      'shifts',
      'discounts',
      'business_config',
      'audit_logs',
      'notifications',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('creó los índices de los que dependen el panel y los reportes', async () => {
    const rows: { indexname: string }[] = await ds.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const indexes = rows.map((r) => r.indexname);

    // Sin estos, cada consulta agregada del dashboard es un recorrido completo de tabla.
    for (const i of [
      'idx_orders_created_at',
      'idx_orders_shift_id',
      'idx_orders_waiter_id',
      'idx_orders_status',
      'idx_osh_order_id',
      'idx_osh_changed_at',
      'idx_osh_to_status',
      'idx_discounts_order_id',
      'idx_discounts_status',
    ]) {
      expect(indexes).toContain(i);
    }
  });

  it('trajo las columnas que el recibo necesita de business_config', async () => {
    const rows: { column_name: string }[] = await ds.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'business_config'`,
    );
    const columns = rows.map((r) => r.column_name);
    for (const c of ['tax_id', 'tax_rate', 'email', 'receipt_footer']) {
      expect(columns).toContain(c);
    }
  });

  it('el seed es idempotente: repetirlo no duplica nada', async () => {
    const counts = async () => {
      const [row]: { users: string; roles: string; perms: string; links: string }[] =
        await ds.query(
          `SELECT (SELECT count(*) FROM users) AS users,
                  (SELECT count(*) FROM roles) AS roles,
                  (SELECT count(*) FROM permissions) AS perms,
                  (SELECT count(*) FROM role_permissions) AS links`,
        );
      return row;
    };

    const before = await counts();
    await runSeeds(ds);
    const after = await counts();

    expect(after).toEqual(before);
  });
});
