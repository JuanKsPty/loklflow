import { DataSource } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../roles/entities/permission.entity';
import { RolePermission } from '../../roles/entities/role-permission.entity';

const SYSTEM_ROLES: {
  name: string;
  description: string;
  maxDiscountPercentage: number;
  permissions: string[];
}[] = [
  {
    name: 'Administrador',
    description: 'Acceso completo al sistema',
    maxDiscountPercentage: 100,
    permissions: [
      'users:create', 'users:read', 'users:update', 'users:delete',
      'roles:create', 'roles:read', 'roles:update', 'roles:delete',
      'business_config:read', 'business_config:update',
      'audit:read',
      'orders:create', 'orders:read', 'orders:update', 'orders:delete',
      'menu:create', 'menu:read', 'menu:update', 'menu:delete',
      'tables:create', 'tables:read', 'tables:update', 'tables:delete',
      'pos:create', 'pos:read', 'pos:approve_discount',
      'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete',
    ],
  },
  {
    name: 'Gerente',
    description: 'Gestión operativa del negocio',
    maxDiscountPercentage: 50,
    permissions: [
      'users:create', 'users:read', 'users:update',
      'roles:read',
      'business_config:read',
      'audit:read',
      'orders:create', 'orders:read', 'orders:update',
      'menu:read', 'menu:update',
      'tables:read', 'tables:update',
      'pos:create', 'pos:read', 'pos:approve_discount',
      'inventory:read', 'inventory:update',
    ],
  },
  {
    name: 'Mesero',
    description: 'Toma de órdenes y atención al cliente',
    maxDiscountPercentage: 0,
    permissions: [
      'orders:create', 'orders:read', 'orders:update',
      'menu:read',
      'tables:read', 'tables:update',
    ],
  },
  {
    name: 'Cocina',
    description: 'Visualización y gestión de órdenes en cocina',
    maxDiscountPercentage: 0,
    permissions: [
      'orders:read', 'orders:update',
      'menu:read',
    ],
  },
  {
    name: 'Cajero',
    description: 'Punto de venta y cobro',
    maxDiscountPercentage: 10,
    permissions: [
      'orders:create', 'orders:read',
      'pos:create', 'pos:read',
      'menu:read',
    ],
  },
];

export async function seedRoles(dataSource: DataSource) {
  const rolesRepo = dataSource.getRepository(Role);
  const permissionsRepo = dataSource.getRepository(Permission);
  const rpRepo = dataSource.getRepository(RolePermission);

  for (const roleDef of SYSTEM_ROLES) {
    let role = await rolesRepo.findOne({ where: { name: roleDef.name } });
    if (!role) {
      role = await rolesRepo.save(
        rolesRepo.create({
          name: roleDef.name,
          description: roleDef.description,
          maxDiscountPercentage: roleDef.maxDiscountPercentage,
          isSystem: true,
        }),
      );
    }

    await rpRepo.delete({ role: { id: role.id } });

    const permissions = await permissionsRepo.findBy(
      roleDef.permissions.map((key) => ({ key })),
    );
    const rps = permissions.map((p) => rpRepo.create({ role, permission: p }));
    await rpRepo.save(rps);
  }
  console.log(`✓ System roles seeded (${SYSTEM_ROLES.length} roles)`);
}
