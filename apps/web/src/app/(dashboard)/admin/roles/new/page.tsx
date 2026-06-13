import { serverFetch } from '@/lib/api/server-client';
import { RoleForm } from '@/components/admin/role-form';
import { PageHeader } from '@/components/page-header';
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
      <PageHeader title="Nuevo rol" description="Crea un rol y asígnale permisos." />
      <RoleForm allPermissions={allPermissions} />
    </div>
  );
}
