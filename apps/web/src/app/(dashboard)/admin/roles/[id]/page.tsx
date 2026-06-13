import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { RoleForm } from '@/components/admin/role-form';
import { PageHeader } from '@/components/page-header';
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
        <PageHeader title="Editar rol" description={role.name} />
        <RoleForm role={role} allPermissions={allPermissions} />
      </div>
    );
  } catch {
    notFound();
  }
}
