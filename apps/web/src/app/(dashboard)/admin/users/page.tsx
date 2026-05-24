import { serverFetch } from '@/lib/api/server-client';
import { UserTable } from '@/components/admin/user-table';
import type { User } from '@loklflow/types';

export const metadata = { title: 'Empleados — LoklFlow' };

export default async function UsersPage() {
  let users: User[] = [];
  try {
    users = await serverFetch<User[]>('/users');
  } catch {
    // muestra tabla vacía si la API no está disponible
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Empleados</h1>
        <a
          href="/admin/users/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nuevo empleado
        </a>
      </div>
      <UserTable users={users} />
    </div>
  );
}
