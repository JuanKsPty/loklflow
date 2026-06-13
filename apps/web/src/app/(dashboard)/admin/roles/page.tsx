import Link from 'next/link';
import { PlusIcon, ShieldIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
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
import type { Role } from '@loklflow/types';

export const metadata = { title: 'Roles — LoklFlow' };

export default async function RolesPage() {
  let roles: Role[] = [];
  try {
    roles = await serverFetch<Role[]>('/roles');
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

      {roles.length === 0 ? (
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
