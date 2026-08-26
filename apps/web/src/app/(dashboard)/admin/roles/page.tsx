import Link from 'next/link';
import { PlusIcon, ShieldIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { hasAnyFilter } from '@/lib/url';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { FilterBar } from '@/components/admin/filters/filter-bar';
import { NoMatches } from '@/components/admin/filters/no-matches';
import { SearchField } from '@/components/admin/filters/search-field';
import type { Role } from '@loklflow/types';

export const metadata = { title: 'Roles — LoklFlow' };

const BASE_PATH = '/admin/roles';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function RolesPage({ searchParams }: Props) {
  const { q: crudo } = await searchParams;
  const q = crudo?.trim() || undefined;
  const params = { q };
  const hayFiltros = hasAnyFilter(params);

  let roles: Role[] = [];
  try {
    roles = await serverFetch<Role[]>(`/roles${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  } catch {
    // muestra tabla vacía si la API no está disponible
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Define permisos y límites de descuento por rol."
        action={
          <Button nativeButton={false} render={<Link href="/admin/roles/new" />}>
            <PlusIcon />
            Nuevo rol
          </Button>
        }
      />

      <FilterBar basePath={BASE_PATH}>
        <SearchField
          basePath={BASE_PATH}
          params={params}
          defaultValue={q ?? ''}
          placeholder="Buscar un rol"
          label="Buscar un rol por su nombre"
        />
      </FilterBar>

      {hayFiltros && roles.length === 0 ? (
        <NoMatches basePath={BASE_PATH} what="roles" />
      ) : roles.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldIcon />
            </EmptyMedia>
            <EmptyTitle>Sin roles</EmptyTitle>
            <EmptyDescription>Aún no hay roles registrados.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Desc. máx.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.description ?? '—'}</TableCell>
                  <TableCell className="font-mono tabular-nums">{r.maxDiscountPercentage}%</TableCell>
                  <TableCell>
                    {r.isSystem ? <Badge variant="secondary">Sistema</Badge> : <Badge variant="outline">Personalizado</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/roles/${r.id}`} />}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
