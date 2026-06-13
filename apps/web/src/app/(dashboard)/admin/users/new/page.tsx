import { serverFetch } from '@/lib/api/server-client';
import { UserForm } from '@/components/admin/user-form';
import { PageHeader } from '@/components/page-header';
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
      <PageHeader title="Nuevo empleado" description="Registra un nuevo miembro del personal." />
      <UserForm roles={roles} />
    </div>
  );
}
