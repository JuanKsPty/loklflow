import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon, PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TableStatusControl } from '@/components/waiter/table-status-control';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
} from '@/components/admin/orders/constants';
import { TABLE_STATUS_LABELS } from '@/components/admin/tables/constants';
import type { Order, RestaurantTable } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

const CLOSED = new Set(['closed', 'cancelled']);

export default async function WaiterTablePage({ params }: Props) {
  const { id } = await params;

  let table: RestaurantTable;
  let orders: Order[] = [];
  try {
    [table, orders] = await Promise.all([
      serverFetch<RestaurantTable>(`/tables/${id}`),
      serverFetch<Order[]>(`/orders?tableId=${id}`),
    ]);
  } catch {
    notFound();
  }

  const activeOrder = orders.find((o) => !CLOSED.has(o.status));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/waiter" />}>
          <ChevronLeftIcon />
          Salón
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Mesa {table.number}</h1>
          <Badge variant="outline">{TABLE_STATUS_LABELS[table.status]}</Badge>
        </div>
        {table.sector && (
          <p className="text-sm text-muted-foreground">
            {table.sector.name} · {table.capacity} personas
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Estado de la mesa</p>
        <TableStatusControl tableId={table.id} current={table.status} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Orden activa</p>
        {activeOrder ? (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">Orden #{activeOrder.orderNumber}</p>
                <Badge variant="outline" className={ORDER_STATUS_BADGE[activeOrder.status]}>
                  {ORDER_STATUS_LABELS[activeOrder.status]}
                </Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(activeOrder.items ?? []).length} ítem(s) · {formatPrice(activeOrder.total)}
                </p>
              </div>
              <Button nativeButton={false} render={<Link href={`/waiter/orden/${activeOrder.id}`} />}>
                Ver
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Button
            size="lg"
            className="w-full"
            nativeButton={false}
            render={<Link href={`/waiter/nueva?tableId=${table.id}`} />}
          >
            <PlusIcon />
            Tomar orden
          </Button>
        )}
      </div>

      <RealtimeRefresher events={['table:changed', 'order:changed']} />
    </div>
  );
}
