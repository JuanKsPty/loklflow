import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckoutPanel } from '@/components/pos/checkout-panel';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';
import { formatPrice } from '@/lib/format';
import type { Order } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PosCheckoutPage({ params }: Props) {
  const { id } = await params;
  let order: Order;
  try {
    order = await serverFetch<Order>(`/orders/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href="/pos" />}>
          <ChevronLeftIcon />
          Cuentas
        </Button>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{order.label || `Cuenta #${order.orderNumber}`}</h1>
            <p className="text-sm text-muted-foreground">
              {order.table ? `Mesa ${order.table.number}` : 'Para llevar'} · #{order.orderNumber} ·{' '}
              {(order.items ?? []).length} ítem(s)
            </p>
          </div>
          <Badge variant="outline" className={ORDER_STATUS_BADGE[order.status]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>
      </div>

      <ul className="rounded-xl border text-sm">
        {(order.items ?? []).map((item) => (
          <li key={item.id} className="flex justify-between gap-2 border-b px-3 py-2 last:border-0">
            <span>
              {item.quantity}× {item.product?.name ?? 'Producto'}
            </span>
            <span className="tabular-nums text-muted-foreground">{formatPrice(item.subtotal)}</span>
          </li>
        ))}
      </ul>

      <CheckoutPanel order={order} />
      <RealtimeRefresher events={['order:changed']} />
    </div>
  );
}
