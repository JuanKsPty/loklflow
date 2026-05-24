import { DataSource } from 'typeorm';
import { Permission } from '../../roles/entities/permission.entity';

const PERMISSIONS = [
  { module: 'users', action: 'create' },
  { module: 'users', action: 'read' },
  { module: 'users', action: 'update' },
  { module: 'users', action: 'delete' },
  { module: 'roles', action: 'create' },
  { module: 'roles', action: 'read' },
  { module: 'roles', action: 'update' },
  { module: 'roles', action: 'delete' },
  { module: 'business_config', action: 'read' },
  { module: 'business_config', action: 'update' },
  { module: 'audit', action: 'read' },
  { module: 'orders', action: 'create' },
  { module: 'orders', action: 'read' },
  { module: 'orders', action: 'update' },
  { module: 'orders', action: 'delete' },
  { module: 'menu', action: 'create' },
  { module: 'menu', action: 'read' },
  { module: 'menu', action: 'update' },
  { module: 'menu', action: 'delete' },
  { module: 'tables', action: 'create' },
  { module: 'tables', action: 'read' },
  { module: 'tables', action: 'update' },
  { module: 'tables', action: 'delete' },
  { module: 'pos', action: 'create' },
  { module: 'pos', action: 'read' },
  { module: 'pos', action: 'approve_discount' },
  { module: 'inventory', action: 'create' },
  { module: 'inventory', action: 'read' },
  { module: 'inventory', action: 'update' },
  { module: 'inventory', action: 'delete' },
];

export async function seedPermissions(dataSource: DataSource) {
  const repo = dataSource.getRepository(Permission);
  for (const p of PERMISSIONS) {
    const key = `${p.module}:${p.action}`;
    const existing = await repo.findOne({ where: { key } });
    if (!existing) {
      await repo.save(repo.create({ module: p.module, action: p.action, key }));
    }
  }
  console.log(`✓ Permissions seeded (${PERMISSIONS.length} definitions)`);
}
