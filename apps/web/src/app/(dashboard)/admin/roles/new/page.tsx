import { serverFetch } from '@/lib/api/server-client';
import { RoleForm } from '@/components/admin/role-form';
import type { Permission } from '@loklflow/types';

export const metadata = { title: 'Nuevo rol — LoklFlow' };

export default async function NewRolePage() {
  let allPermissions: Permission[] = [];
  try {
    allPermissions = await serverFetch<Permission[]>('/roles/permissions');
  } catch {
    // muestra formulario sin permisos si la API no está disponible
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Nuevo rol</h1>
      </div>
      <RoleForm allPermissions={allPermissions} />
    </div>
  );
}
