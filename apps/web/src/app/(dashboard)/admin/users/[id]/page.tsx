import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { UserForm } from '@/components/admin/user-form';
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
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Editar empleado</h1>
          <p className="text-sm text-gray-500 mt-1">{user.name}</p>
        </div>
        <UserForm user={user} roles={roles} />
      </div>
    );
  } catch {
    notFound();
  }
}
