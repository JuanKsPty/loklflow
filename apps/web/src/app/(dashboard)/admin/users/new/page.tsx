import { serverFetch } from '@/lib/api/server-client';
import { UserForm } from '@/components/admin/user-form';
import type { Role } from '@loklflow/types';

export const metadata = { title: 'Nuevo empleado — LoklFlow' };

export default async function NewUserPage() {
  let roles: Role[] = [];
  try {
    roles = await serverFetch<Role[]>('/roles');
  } catch {
    // muestra formulario sin roles si la API no está disponible
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Nuevo empleado</h1>
      </div>
      <UserForm roles={roles} />
    </div>
  );
}
