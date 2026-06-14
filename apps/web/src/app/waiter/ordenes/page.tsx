import Link from 'next/link';
import { serverFetch } from '@/lib/api/server-client';
import { cn } from '@/lib/utils';
import { OrderCard } from '@/components/waiter/order-card';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import { ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';
import type { Order, OrderStatus } from '@loklflow/types';

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const CLOSED = new Set(['closed', 'cancelled']);
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

  let orders: Order[] = [];
  try {
    orders =
      current === 'active'
        ? (await serverFetch<Order[]>('/orders')).filter((o) => !CLOSED.has(o.status))
        : await serverFetch<Order[]>(`/orders?status=${current}`);
  } catch {
    // lista vacía si la API no responde
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Órdenes</h1>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = current === f.value;
          const href = f.value === 'active' ? '/waiter/ordenes' : `/waiter/ordenes?status=${f.value}`;
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

      {orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No hay órdenes.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      <RealtimeRefresher events={['order:changed']} toastOnNewOrder />
    </div>
  );
}
