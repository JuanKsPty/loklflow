import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { hasAnyFilter } from '@/lib/url';
import { UserTable } from '@/components/admin/user-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/admin/filters/filter-bar';
import { NoMatches } from '@/components/admin/filters/no-matches';
import { SearchField } from '@/components/admin/filters/search-field';
import { SelectFilter } from '@/components/admin/filters/select-filter';
import type { Role, User } from '@loklflow/types';

export const metadata = { title: 'Empleados — LoklFlow' };

const BASE_PATH = '/admin/users';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  searchParams: Promise<{ q?: string; roleId?: string }>;
}

export default async function UsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  // Lista blanca: un `roleId` que no sea un uuid lo rechaza la API con un 400 que tumbaría
  // la pantalla entera en vez de enseñar una tabla sin filtrar.
  const roleId = UUID.test(sp.roleId ?? '') ? sp.roleId : undefined;
  const params = { q, roleId };
  const hayFiltros = hasAnyFilter(params);

  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (roleId) query.set('roleId', roleId);
  const qs = query.toString();

  let users: User[] = [];
  try {
    users = await serverFetch<User[]>(`/users${qs ? `?${qs}` : ''}`);
  } catch {
    // muestra tabla vacía si la API no está disponible
  }

  // En su propio `try`: es la única petición de esta pantalla que pide `roles:read`, y quien no
  // lo tenga debe quedarse sin desplegable, no sin listado.
  let roles: Role[] = [];
  try {
    roles = await serverFetch<Role[]>('/roles');
  } catch {
    // sin desplegable de roles
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
      <FilterBar basePath={BASE_PATH}>
        <SearchField
          basePath={BASE_PATH}
          params={params}
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre o correo"
          label="Buscar un empleado por su nombre o su correo"
        />
        {roles.length > 0 && (
          <SelectFilter
            basePath={BASE_PATH}
            params={params}
            name="roleId"
            label="Filtrar por rol"
            value={roleId}
            allLabel="Todos los roles"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
        )}
      </FilterBar>
      {hayFiltros && users.length === 0 ? (
        <NoMatches basePath={BASE_PATH} what="empleados" />
      ) : (
        <UserTable users={users} />
      )}
    </div>
  );
}
