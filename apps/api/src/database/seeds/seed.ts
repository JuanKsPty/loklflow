import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { databaseOptions } from '../../config/database.config';
import { loadRootEnv } from '../../config/load-root-env';
import { seedPermissions } from './permissions.seed';
import { seedRoles } from './roles.seed';
import { seedMenu } from './menu.seed';
import { seedTables } from './tables.seed';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { BusinessConfig } from '../../business-config/entities/business-config.entity';

// Antes era `dotenv.config()` sin ruta, que busca en el CWD —apps/api al correr el
// script—, donde no hay ningún .env. No se notaba porque los valores por defecto de la
// conexión coinciden con docker-compose, así que el seed acababa siempre en la base de
// desarrollo aunque se le pidiera otra.
loadRootEnv();

/**
 * La conexión sale de `databaseOptions()`, la misma que usan la app y la CLI de TypeORM.
 *
 * Antes se declaraba aquí a mano, con tres consecuencias: ignoraba `DATABASE_URL` (así que
 * no había forma de sembrar un Postgres gestionado ni el de un contenedor), forzaba
 * `synchronize: true` sin mirar el entorno —creando el esquema al margen de las
 * migraciones, justo lo que el proyecto prohíbe fuera de desarrollo— y mantenía la lista
 * de entidades a mano, que ya se había quedado atrás: le faltaba `Discount`.
 */
const dataSource = new DataSource(databaseOptions() as DataSourceOptions);

async function seedAdmin(ds: DataSource) {
  const usersRepo = ds.getRepository(User);
  const rolesRepo = ds.getRepository(Role);

  const adminRole = await rolesRepo.findOne({ where: { name: 'Administrador' } });
  if (!adminRole) {
    console.error('Admin role not found — run roles seed first');
    return;
  }

  const existing = await usersRepo.findOne({ where: { email: 'admin@loklflow.com' } });
  if (!existing) {
    await usersRepo.save(
      usersRepo.create({
        name: 'Administrador',
        email: 'admin@loklflow.com',
        password: await bcrypt.hash('Admin1234!', 10),
        role: adminRole,
        isActive: true,
      }),
    );
    console.log('✓ Admin user seeded — email: admin@loklflow.com / password: Admin1234!');
  } else {
    console.log('✓ Admin user already exists');
  }
}

async function seedWaiter(ds: DataSource) {
  const usersRepo = ds.getRepository(User);
  const rolesRepo = ds.getRepository(Role);

  const waiterRole = await rolesRepo.findOne({ where: { name: 'Mesero' } });
  if (!waiterRole) {
    console.error('Mesero role not found — run roles seed first');
    return;
  }

  const existing = await usersRepo.findOne({ where: { email: 'mesero@loklflow.com' } });
  if (!existing) {
    await usersRepo.save(
      usersRepo.create({
        name: 'Mesero Demo',
        email: 'mesero@loklflow.com',
        pin: await bcrypt.hash('1234', 10),
        role: waiterRole,
        isActive: true,
      }),
    );
    console.log('✓ Waiter user seeded — login por PIN: Mesero Demo / PIN: 1234');
  } else {
    console.log('✓ Waiter user already exists');
  }
}

async function seedKitchen(ds: DataSource) {
  const usersRepo = ds.getRepository(User);
  const rolesRepo = ds.getRepository(Role);

  const kitchenRole = await rolesRepo.findOne({ where: { name: 'Cocina' } });
  if (!kitchenRole) {
    console.error('Cocina role not found — run roles seed first');
    return;
  }

  const existing = await usersRepo.findOne({ where: { email: 'cocina@loklflow.com' } });
  if (!existing) {
    await usersRepo.save(
      usersRepo.create({
        name: 'Cocina Demo',
        email: 'cocina@loklflow.com',
        pin: await bcrypt.hash('5678', 10),
        role: kitchenRole,
        isActive: true,
      }),
    );
    console.log('✓ Kitchen user seeded — login por PIN: Cocina Demo / PIN: 5678');
  } else {
    console.log('✓ Kitchen user already exists');
  }
}

async function seedCashier(ds: DataSource) {
  const usersRepo = ds.getRepository(User);
  const rolesRepo = ds.getRepository(Role);

  const cashierRole = await rolesRepo.findOne({ where: { name: 'Cajero' } });
  if (!cashierRole) {
    console.error('Cajero role not found — run roles seed first');
    return;
  }

  const existing = await usersRepo.findOne({ where: { email: 'cajero@loklflow.com' } });
  if (!existing) {
    await usersRepo.save(
      usersRepo.create({
        name: 'Cajero Demo',
        email: 'cajero@loklflow.com',
        pin: await bcrypt.hash('4321', 10),
        role: cashierRole,
        isActive: true,
      }),
    );
    console.log('✓ Cashier user seeded — login por PIN: Cajero Demo / PIN: 4321');
  } else {
    console.log('✓ Cashier user already exists');
  }
}

async function seedBusinessConfig(ds: DataSource) {
  const repo = ds.getRepository(BusinessConfig);
  const existing = await repo.findOne({ where: {} });
  if (!existing) {
    await repo.save(
      repo.create({
        businessName: 'Mi Restaurante',
        timezone: 'America/Mexico_City',
        currency: 'MXN',
      }),
    );
    console.log('✓ Business config seeded');
  }
}

/**
 * Siembra sobre un datasource ya conectado. Exportado aparte del script para que el arranque
 * de los tests de integración pueda sembrar su base sin duplicar la lista de pasos ni
 * abrir una segunda conexión.
 */
export async function runSeeds(ds: DataSource): Promise<void> {
  await seedPermissions(ds);
  await seedRoles(ds);
  await seedAdmin(ds);
  await seedWaiter(ds);
  await seedKitchen(ds);
  await seedCashier(ds);
  await seedBusinessConfig(ds);
  await seedMenu(ds);
  await seedTables(ds);
}

async function main() {
  await dataSource.initialize();
  console.log('Database connected. Running seeds...\n');

  await runSeeds(dataSource);

  await dataSource.destroy();
  console.log('\nAll seeds completed successfully.');
}

// Solo cuando se ejecuta como script (`pnpm seed`). Sin esta guarda, importar `runSeeds`
// desde los tests dispararía además una conexión y una siembra a la base del .env.
if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
