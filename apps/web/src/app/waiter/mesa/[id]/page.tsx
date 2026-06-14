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

  const openAccounts = orders
    .filter((o) => !CLOSED.has(o.status))
    .sort((a, b) => a.orderNumber - b.orderNumber);

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
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Cuentas {openAccounts.length > 0 && `(${openAccounts.length})`}
          </p>
          <Button size="sm" nativeButton={false} render={<Link href={`/waiter/nueva?tableId=${table.id}`} />}>
            <PlusIcon />
            Nueva cuenta
          </Button>
        </div>

        {openAccounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">No hay cuentas abiertas en esta mesa.</p>
              <Button nativeButton={false} render={<Link href={`/waiter/nueva?tableId=${table.id}`} />}>
                <PlusIcon />
                Tomar orden
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {openAccounts.map((account) => (
              <Link key={account.id} href={`/waiter/orden/${account.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="font-medium">{account.label || `Cuenta #${account.orderNumber}`}</p>
                      {account.label && (
                        <p className="text-xs text-muted-foreground">#{account.orderNumber}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(account.items ?? []).length} ítem(s) · {formatPrice(account.total)}
                      </p>
                    </div>
                    <Badge variant="outline" className={ORDER_STATUS_BADGE[account.status]}>
                      {ORDER_STATUS_LABELS[account.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <RealtimeRefresher events={['table:changed', 'order:changed']} />
    </div>
  );
}
