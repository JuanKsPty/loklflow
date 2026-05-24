import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { RoleForm } from '@/components/admin/role-form';
import type { RoleWithPermissions, Permission } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditRolePage({ params }: Props) {
  const { id } = await params;

  try {
    const [role, allPermissions] = await Promise.all([
      serverFetch<RoleWithPermissions>(`/roles/${id}`),
      serverFetch<Permission[]>('/roles/permissions'),
    ]);

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Editar rol</h1>
          <p className="text-sm text-gray-500 mt-1">{role.name}</p>
        </div>
        <RoleForm role={role} allPermissions={allPermissions} />
      </div>
    );
  } catch {
    notFound();
  }
}
