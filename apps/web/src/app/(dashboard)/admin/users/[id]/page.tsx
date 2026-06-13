import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { UserForm } from '@/components/admin/user-form';
import { PageHeader } from '@/components/page-header';
import type { User, Role } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: Props) {
  const { id } = await params;

  try {
    const [user, roles] = await Promise.all([
      serverFetch<User>(`/users/${id}`),
      serverFetch<Role[]>('/roles'),
    ]);

    return (
      <div>
        <PageHeader title="Editar empleado" description={user.name} />
        <UserForm user={user} roles={roles} />
      </div>
    );
  } catch {
    notFound();
  }
}
