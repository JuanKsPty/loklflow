import Link from 'next/link';
import { LockOpenIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { formatPrice } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';
import type { Order, ShiftSummary } from '@loklflow/types';

const CLOSED = new Set(['closed', 'cancelled']);

function paidOf(order: Order): number {
  return Number((order.payments ?? []).reduce((s, p) => s + Number(p.amount), 0).toFixed(2));
}

export default async function PosPage() {
  let orders: Order[] = [];
  try {
    orders = await serverFetch<Order[]>('/orders');
  } catch {
    // lista vacía si la API no responde
  }

  let shift: ShiftSummary | null = null;
  try {
    shift = await serverFetch<ShiftSummary | null>('/shifts/current');
  } catch {
    // sin turno si la API no responde
  }

  const toCharge = orders
    .filter((o) => !CLOSED.has(o.status) && o.total > 0)
    .sort((a, b) => a.orderNumber - b.orderNumber);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Cuentas por cobrar</h1>

      {!shift && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary">
          <LockOpenIcon className="size-4 shrink-0" />
          <span>No tienes turno abierto. Abre tu turno (botón arriba) para poder cobrar.</span>
        </div>
      )}

      {toCharge.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No hay cuentas por cobrar.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {toCharge.map((order) => {
            const paid = paidOf(order);
            const remaining = Number(Math.max(0, order.total - paid).toFixed(2));
            return (
              <Link key={order.id} href={`/pos/${order.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="font-medium">{order.label || `Cuenta #${order.orderNumber}`}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.table ? `Mesa ${order.table.number}` : 'Para llevar'} · #{order.orderNumber}
                      </p>
                      {paid > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Pagado {formatPrice(paid)} · Restante {formatPrice(remaining)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className={ORDER_STATUS_BADGE[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      <span className="text-base font-semibold tabular-nums">{formatPrice(order.total)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <RealtimeRefresher events={['order:changed', 'shift:changed']} />
    </div>
  );
}
