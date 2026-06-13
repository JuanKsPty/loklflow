import Link from 'next/link';
import { LayoutGridIcon } from 'lucide-react';
import type { RestaurantTable } from '@loklflow/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { TABLE_STATUS_LABELS } from './constants';

interface Props {
  tables: RestaurantTable[];
}

export function TableList({ tables }: Props) {
  if (tables.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutGridIcon />
          </EmptyMedia>
          <EmptyTitle>Sin mesas</EmptyTitle>
          <EmptyDescription>Crea la primera mesa y asígnala a un sector.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Número</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>Capacidad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tables.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.number}</TableCell>
              <TableCell className="text-muted-foreground">{t.sector?.name ?? '—'}</TableCell>
              <TableCell>{t.capacity}</TableCell>
              <TableCell>
                <Badge variant="secondary">{TABLE_STATUS_LABELS[t.status]}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/tables/tables/${t.id}`} />}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
