import Link from 'next/link';
import { ReceiptTextIcon } from 'lucide-react';
import type { Order } from '@loklflow/types';
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
import { formatPrice } from '@/lib/format';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from './constants';

interface Props {
  orders: Order[];
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function OrderTable({ orders }: Props) {
  if (orders.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ReceiptTextIcon />
          </EmptyMedia>
          <EmptyTitle>Sin órdenes</EmptyTitle>
          <EmptyDescription>Crea la primera orden para comenzar.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">#</TableHead>
            <TableHead>Mesa</TableHead>
            <TableHead>Ítems</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium">#{o.orderNumber}</TableCell>
              <TableCell className="text-muted-foreground">
                {o.table ? `Mesa ${o.table.number}` : 'Para llevar'}
              </TableCell>
              <TableCell>{o.items?.length ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPrice(o.total)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={ORDER_STATUS_BADGE[o.status]}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatTime(o.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/orders/${o.id}`} />}>
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
