import Link from 'next/link';
import { PercentIcon } from 'lucide-react';
import type { Discount } from '@loklflow/types';
import { DISCOUNT_STATUS_LABELS } from '@loklflow/types';
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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { formatPrice } from '@/lib/format';
import { ApprovalActions } from './approval-actions';
import { DISCOUNT_STATUS_BADGE } from './constants';

interface Props {
  discounts: Discount[];
  /** Solo los pendientes se pueden resolver; el historial es de solo lectura. */
  resolvable: boolean;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ApprovalsTable({ discounts, resolvable }: Props) {
  if (discounts.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PercentIcon />
          </EmptyMedia>
          <EmptyTitle>Sin solicitudes</EmptyTitle>
          <EmptyDescription>
            {resolvable
              ? 'No hay descuentos esperando aprobación.'
              : 'Todavía no hay descuentos registrados.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Solicitado</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead className="text-right">Descuento</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {discounts.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                {formatDateTime(d.createdAt)}
              </TableCell>
              <TableCell className="font-medium">
                {d.order ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/admin/orders/${d.orderId}`} />}
                  >
                    #{d.order.orderNumber}
                  </Button>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.requestedByName ?? '—'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPrice(d.amount)}
                <span className="text-muted-foreground ml-1 text-xs">({d.percentage}%)</span>
              </TableCell>
              <TableCell className="max-w-xs text-sm">
                {d.reason}
                {d.rejectionReason && (
                  <span className="text-destructive mt-0.5 block text-xs">
                    Rechazado: {d.rejectionReason}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={DISCOUNT_STATUS_BADGE[d.status]}>
                  {DISCOUNT_STATUS_LABELS[d.status]}
                </Badge>
                {d.status !== 'pending' && d.approvedByName && (
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    por {d.approvedByName}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {resolvable && d.status === 'pending' && (
                  <ApprovalActions
                    discountId={d.id}
                    amountLabel={`${formatPrice(d.amount)} (${d.percentage}%)`}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
