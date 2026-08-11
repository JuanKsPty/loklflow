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
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
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
    <>
      {/*
        Tarjeta por fila en el móvil, tabla a partir de `sm`.
        
        Solo aquí y en el panel: `ui/table` envuelve en `overflow-x-auto`, así que las otras trece
        tablas del área de administración **no se rompen**, se desplazan dentro de su contenedor.
        Construir quince renderizados duales sería una semana de trabajo para pantallas que se
        abren desde un portátil. Estas dos son las que un dueño mira desde el teléfono, y por eso
        son la excepción. La decisión está escrita en `design-system.md`.
      */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {orders.map((o) => (
          <li key={o.id} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">#{o.orderNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {o.table ? `Mesa ${o.table.number}` : 'Para llevar'} · {o.items?.length ?? 0}{' '}
                  ítem(s)
                </p>
              </div>
              <Badge variant="outline" className={ORDER_STATUS_BADGE[o.status]}>
                {ORDER_STATUS_LABELS[o.status]}
              </Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold tabular-nums">{formatPrice(o.total)}</p>
                <p className="text-xs text-muted-foreground">{formatTime(o.createdAt)}</p>
              </div>
              <Button
                variant="outline"
                size="touch"
                nativeButton={false}
                render={<Link href={`/admin/orders/${o.id}`} />}
              >
                Ver
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-xl border sm:block">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/admin/orders/${o.id}`} />}
                  >
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
