import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { seedPermissions } from './permissions.seed';
import { seedRoles } from './roles.seed';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../roles/entities/permission.entity';
import { RolePermission } from '../../roles/entities/role-permission.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { BusinessConfig } from '../../business-config/entities/business-config.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'loklflow',
  password: process.env.DATABASE_PASSWORD ?? 'loklflow',
  database: process.env.DATABASE_NAME ?? 'loklflow_db',
  entities: [User, Role, Permission, RolePermission, RefreshToken, BusinessConfig, AuditLog],
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
  await seedBusinessConfig(dataSource);

  await dataSource.destroy();
  console.log('\nAll seeds completed successfully.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
