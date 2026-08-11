import Link from 'next/link';
import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { cn } from '@/lib/utils';
import { OrdersView } from '@/components/waiter/orders-view';
import { ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';
import type { Order, OrderStatus } from '@loklflow/types';
import { PageHeader } from '@/components/page-header';

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const FILTERS: { value: OrderStatus | 'active'; label: string }[] = [
  { value: 'active', label: 'Activas' },
  { value: 'pending', label: ORDER_STATUS_LABELS.pending },
  { value: 'preparing', label: ORDER_STATUS_LABELS.preparing },
  { value: 'ready', label: ORDER_STATUS_LABELS.ready },
  { value: 'delivered', label: ORDER_STATUS_LABELS.delivered },
];

export default async function WaiterOrdersPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const current = status ?? 'active';

  let orders: Order[] | null = null;
  try {
    // La pestaña «activas» las filtra el servidor con open=true, en lugar de traerse el
    // histórico completo y descartar aquí lo cerrado.
    orders =
      current === 'active'
        ? await serverFetch<Order[]>('/orders?open=true')
        : await serverFetch<Order[]>(`/orders?status=${current}`);
  } catch (err) {
    // Se registra igual, pero ya no decide la pantalla: con `null` la vista arranca con las
    // órdenes que el dispositivo tenía guardadas.
    reportApiFailure('waiter/ordenes', err);
  }

  return (
    <div>
      <PageHeader title="Órdenes" />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = current === f.value;
          const href =
            f.value === 'active' ? '/waiter/ordenes' : `/waiter/ordenes?status=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <OrdersView filter={current} initialOrders={orders} />
    </div>
  );
}
