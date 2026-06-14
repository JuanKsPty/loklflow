import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { seedPermissions } from './permissions.seed';
import { seedRoles } from './roles.seed';
import { seedMenu } from './menu.seed';
import { seedTables } from './tables.seed';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../roles/entities/permission.entity';
import { RolePermission } from '../../roles/entities/role-permission.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { BusinessConfig } from '../../business-config/entities/business-config.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Category } from '../../menu/entities/category.entity';
import { Product } from '../../menu/entities/product.entity';
import { ProductAvailability } from '../../menu/entities/product-availability.entity';
import { Modifier } from '../../menu/entities/modifier.entity';
import { ModifierOption } from '../../menu/entities/modifier-option.entity';
import { Combo } from '../../menu/entities/combo.entity';
import { ComboItem } from '../../menu/entities/combo-item.entity';
import { Sector } from '../../tables/entities/sector.entity';
import { RestaurantTable } from '../../tables/entities/table.entity';
import { Reservation } from '../../tables/entities/reservation.entity';
import { Order } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { OrderItemModifier } from '../../orders/entities/order-item-modifier.entity';
import { OrderStatusHistory } from '../../orders/entities/order-status-history.entity';
import { Notification } from '../../notifications/entities/notification.entity';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'loklflow',
  password: process.env.DATABASE_PASSWORD ?? 'loklflow',
  database: process.env.DATABASE_NAME ?? 'loklflow_db',
  entities: [
    User,
    Role,
    Permission,
    RolePermission,
    RefreshToken,
    BusinessConfig,
    AuditLog,
    Category,
    Product,
    ProductAvailability,
    Modifier,
    ModifierOption,
    Combo,
    ComboItem,
    Sector,
    RestaurantTable,
    Reservation,
    Order,
    OrderItem,
    OrderItemModifier,
    OrderStatusHistory,
    Notification,
  ],
  synchronize: true,
});

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

async function main() {
  await dataSource.initialize();
  console.log('Database connected. Running seeds...\n');

  await seedPermissions(dataSource);
  await seedRoles(dataSource);
  await seedAdmin(dataSource);
  await seedWaiter(dataSource);
  await seedKitchen(dataSource);
  await seedBusinessConfig(dataSource);
  await seedMenu(dataSource);
  await seedTables(dataSource);

  await dataSource.destroy();
  console.log('\nAll seeds completed successfully.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
