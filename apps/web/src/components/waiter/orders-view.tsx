'use client';

import { useMemo } from 'react';
import type { Order } from '@loklflow/types';
import { COLLECTIONS } from '@/lib/offline/cache';
import { useCachedCollection } from '@/lib/offline/use-cache';
import { usePendingOperations } from '@/lib/offline/use-outbox';
import { applyPendingToOrders, byPartition } from '@/lib/offline/apply-pending';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ReceiptTextIcon } from 'lucide-react';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { OrderCard } from './order-card';

const CLOSED = new Set(['closed', 'cancelled']);

/**
 * Las órdenes del turno, leídas del dispositivo.
 *
 * El filtro se aplica **en cliente sobre la copia local**, no pidiéndoselo al servidor: sin red
 * no hay a quién pedírselo, y el mesero tiene que poder seguir mirando sus comandas por estado
 * durante el corte. Con red la copia se rehace sola en cada evento del socket, así que el
 * resultado es el mismo que antes.
 */
export function OrdersView({
  filter,
  initialOrders,
}: {
  filter: string;
  initialOrders: Order[] | null;
}) {
  const cached = useCachedCollection<Order>(COLLECTIONS.orders, initialOrders);
  const pending = usePendingOperations();
  const groups = useMemo(() => byPartition(pending), [pending]);

  const orders = useMemo(() => {
    const withPending = applyPendingToOrders(cached, groups);
    const visible =
      filter === 'active'
        ? withPending.filter((o) => !CLOSED.has(o.status))
        : withPending.filter((o) => o.status === filter);
    return visible.sort((a, b) => b.orderNumber - a.orderNumber);
  }, [cached, groups, filter]);

  if (orders.length === 0 && cached.length === 0 && initialOrders === null) {
    return (
      <>
        <ApiDownNotice what="las órdenes" reason="offline" />
        <RealtimeInvalidator
          events={['order:changed']}
          collection={COLLECTIONS.orders}
          path="/orders?open=true"
          toastOnNewOrder
        />
      </>
    );
  }

  return (
    <>
      {orders.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <ReceiptTextIcon />
          </EmptyMedia>
          <EmptyTitle>No hay órdenes</EmptyTitle>
          <EmptyDescription>
            {filter === 'active'
              ? 'Ninguna cuenta abierta ahora mismo.'
              : 'Ninguna orden en este estado.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
      <RealtimeInvalidator
        events={['order:changed']}
        collection={COLLECTIONS.orders}
        path="/orders?open=true"
        toastOnNewOrder
      />
    </>
  );
}
