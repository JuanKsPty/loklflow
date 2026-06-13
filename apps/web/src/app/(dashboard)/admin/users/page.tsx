import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { UserTable } from '@/components/admin/user-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
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
      <PageHeader
        title="Empleados"
        description="Gestiona el personal y sus accesos."
        action={
          <Button nativeButton={false} render={<Link href="/admin/users/new" />}>
            <PlusIcon />
            Nuevo empleado
          </Button>
        }
      />
      <UserTable users={users} />
    </div>
  );
}
