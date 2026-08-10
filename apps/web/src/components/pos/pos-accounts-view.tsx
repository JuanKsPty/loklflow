'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { LockOpenIcon, WalletIcon } from 'lucide-react';
import type { Order } from '@loklflow/types';
import { COLLECTIONS } from '@/lib/offline/cache';
import { useCachedCollection } from '@/lib/offline/use-cache';
import { usePendingOperations } from '@/lib/offline/use-outbox';
import { applyPendingToOrders, byPartition, pendingIds } from '@/lib/offline/apply-pending';
import { useConnectivity } from '@/components/offline/offline-provider';
import { formatPrice } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { PendingBadge } from '@/components/offline/pending-badge';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';

const CLOSED = new Set(['closed', 'cancelled']);

function paidOf(order: Order): number {
  return Number((order.payments ?? []).reduce((s, p) => s + Number(p.amount), 0).toFixed(2));
}

/**
 * Las cuentas por cobrar, leídas del dispositivo.
 *
 * **Cobrar sigue exigiendo conexión y eso no cambia**: `queueable.ts` se niega a diferir un
 * pago porque el total real de la cuenta puede haber cambiado desde otro dispositivo, y cobrar
 * contra un total viejo deja al cajero con el cajón cuadrado y la cuenta abierta.
 *
 * Lo que sí cambia es que el listado deja de mentir. Con la API caída pintaba «No hay cuentas
 * por cobrar»: una caja vacía y en calma mientras las cuentas seguían abiertas. Ahora enseña
 * las que conoce y avisa de que no se puede cobrar hasta que vuelva la conexión, que es una
 * información accionable —ir a mirar el router— en vez de un silencio.
 */
export function PosAccountsView({
  initialOrders,
  shiftOpen,
  shiftUnknown,
}: {
  initialOrders: Order[] | null;
  shiftOpen: boolean;
  shiftUnknown: boolean;
}) {
  const pending = usePendingOperations();
  const protect = useMemo(() => pendingIds(pending, 'order'), [pending]);
  const cached = useCachedCollection<Order>(COLLECTIONS.orders, initialOrders, 'replace', protect);
  const { online } = useConnectivity();
  const groups = useMemo(() => byPartition(pending), [pending]);

  const toCharge = useMemo(
    () =>
      applyPendingToOrders(cached, groups)
        .filter((o) => !CLOSED.has(o.status) && o.total > 0)
        .sort((a, b) => a.orderNumber - b.orderNumber),
    [cached, groups],
  );

  if (toCharge.length === 0 && cached.length === 0 && initialOrders === null) {
    return (
      <>
        <ApiDownNotice what="las cuentas" reason="offline" />
        <RealtimeInvalidator
          events={['order:changed']}
          collection={COLLECTIONS.orders}
          path="/orders?open=true"
        />
      </>
    );
  }

  return (
    <>
      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
          <WalletIcon className="size-4 shrink-0" />
          <span>
            Sin conexión: estas son las cuentas que conoce este dispositivo y <strong>no se
            puede cobrar</strong> hasta que vuelva. Un cobro necesita el total real de la cuenta.
          </span>
        </div>
      )}

      {!shiftOpen && !shiftUnknown && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary">
          <LockOpenIcon className="size-4 shrink-0" />
          <span>No tienes turno abierto. Abre tu turno (botón arriba) para poder cobrar.</span>
        </div>
      )}

      {toCharge.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <WalletIcon />
          </EmptyMedia>
          <EmptyTitle>No hay cuentas por cobrar</EmptyTitle>
          <EmptyDescription>Todo cobrado por ahora.</EmptyDescription>
        </Empty>
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
                        {order.table ? `Mesa ${order.table.number}` : 'Para llevar'} · #
                        {order.orderNumber}
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
                      <span className="text-base font-semibold tabular-nums">
                        {formatPrice(order.total)}
                      </span>
                      <PendingBadge partition={`order:${order.id}`} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <RealtimeInvalidator
        events={['order:changed', 'shift:changed']}
        collection={COLLECTIONS.orders}
        path="/orders?open=true"
      />
    </>
  );
}
