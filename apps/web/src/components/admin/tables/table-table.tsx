import { LayoutGridIcon } from 'lucide-react';
import type { RestaurantTable } from '@loklflow/types';
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
import { TABLE_STATUS_LABELS } from './constants';
import { RowActions } from './row-actions';

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
                <RowActions
                  kind="table"
                  id={t.id}
                  editHref={`/admin/tables/tables/${t.id}`}
                  confirmTitle={`¿Eliminar la mesa ${t.number}?`}
                  confirmDescription="Se eliminará la mesa de forma permanente. Esta acción no se puede deshacer."
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
