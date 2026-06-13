import { CalendarClockIcon } from 'lucide-react';
import type { Reservation } from '@loklflow/types';
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
import { RESERVATION_STATUS_LABELS } from './constants';
import { RowActions } from './row-actions';

interface Props {
  reservations: Reservation[];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ReservationTable({ reservations }: Props) {
  if (reservations.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClockIcon />
          </EmptyMedia>
          <EmptyTitle>Sin reservas</EmptyTitle>
          <EmptyDescription>Registra la primera reserva de mesa.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Mesa</TableHead>
            <TableHead>Personas</TableHead>
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.customerName}</TableCell>
              <TableCell className="text-muted-foreground">{r.table?.number ?? '—'}</TableCell>
              <TableCell>{r.partySize}</TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(r.reservedAt)}</TableCell>
              <TableCell>
                <Badge variant="secondary">{RESERVATION_STATUS_LABELS[r.status]}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <RowActions
                  kind="reservation"
                  id={r.id}
                  editHref={`/admin/tables/reservations/${r.id}`}
                  confirmTitle={`¿Eliminar la reserva de ${r.customerName}?`}
                  confirmDescription="Se eliminará la reserva de forma permanente. Esta acción no se puede deshacer."
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
