import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { isNotFound, serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { Button } from '@/components/ui/button';
import { TableView } from '@/components/waiter/table-view';
import type { Order, RestaurantTable } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WaiterTablePage({ params }: Props) {
  const { id } = await params;

  let table: RestaurantTable | null = null;
  let orders: Order[] | null = null;
  try {
    [table, orders] = await Promise.all([
      serverFetch<RestaurantTable>(`/tables/${id}`),
      serverFetch<Order[]>(`/orders?tableId=${id}&open=true`),
    ]);
  } catch (err) {
    // Solo un 404 significa que la mesa no está. Cualquier otro fallo es que no pudimos
    // preguntar, y decirle al mesero que su mesa «no existe» es peor que decirle que hay un
    // problema de conexión — o, mejor todavía, enseñarle la mesa que ya tenía guardada.
    if (isNotFound(err)) notFound();
    reportApiFailure('waiter/mesa', err);
  }

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 self-start"
        nativeButton={false}
        render={<Link href="/waiter" />}
      >
        <ChevronLeftIcon />
        Salón
      </Button>
      <TableView tableId={id} initialTable={table} initialOrders={orders} />
    </div>
  );
}
