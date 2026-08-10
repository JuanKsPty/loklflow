'use client';

import { useCallback, useMemo } from 'react';
import type { Order } from '@loklflow/types';
import { api } from '@/lib/api/client';
import { COLLECTIONS, putMany } from '@/lib/offline/cache';
import { useCachedRow } from '@/lib/offline/use-cache';
import { usePendingFor } from '@/lib/offline/use-outbox';
import { applyPendingToOrder } from '@/lib/offline/apply-pending';
import { orderPartition } from '@/lib/api/orders.offline';
import { useConnectivity } from '@/components/offline/offline-provider';
import { formatPrice } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { PendingBadge } from '@/components/offline/pending-badge';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';
import { CheckoutPanel } from './checkout-panel';

/**
 * El cobro de una cuenta.
 *
 * La cuenta se lee del dispositivo para que la pantalla no muera durante un corte, pero **el
 * panel de cobro desaparece sin conexión y en su lugar se dice por qué**. Es deliberado y es la
 * decisión más importante de esta pantalla: dejar el botón puesto sería invitar al cajero a
 * intentar un cobro que la cola va a rechazar, y hacerle descubrir el problema con el cliente
 * delante y el datáfono en la mano.
 *
 * Lo que se enseña en su lugar es lo que necesita saber para actuar: qué debe la cuenta, y que
 * el cobro vuelve solo cuando vuelva la red.
 *
 * También se avisa cuando hay operaciones sin enviar de **esta** cuenta: su total todavía no
 * está confirmado por el servidor, así que cobrarlo ahora es cobrar contra un número que puede
 * cambiar en cuanto la cola se vacíe.
 */
export function CheckoutView({
  orderId,
  initialOrder,
  maxDiscountPercentage,
}: {
  orderId: string;
  initialOrder: Order | null;
  maxDiscountPercentage: number;
}) {
  const cached = useCachedRow<Order>(COLLECTIONS.orders, orderId, initialOrder);
  const pending = usePendingFor(orderPartition(orderId));
  const { online } = useConnectivity();

  const order = useMemo(() => applyPendingToOrder(cached, pending), [cached, pending]);

  const reload = useCallback(async () => {
    try {
      const fresh = await api.get<Order>(`/orders/${orderId}`);
      await putMany(COLLECTIONS.orders, [fresh]);
    } catch {
      // Sin red no hay nada que releer; la vista sigue con lo que tiene.
    }
  }, [orderId]);

  if (!order) {
    return <ApiDownNotice what="la cuenta" reason={initialOrder === null ? 'offline' : 'error'} />;
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {order.label || `Cuenta #${order.orderNumber}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {order.table ? `Mesa ${order.table.number}` : 'Para llevar'} · #{order.orderNumber} ·{' '}
              {(order.items ?? []).length} ítem(s)
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className={ORDER_STATUS_BADGE[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
            <PendingBadge partition={orderPartition(orderId)} />
          </div>
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

      {online ? (
        <>
          {pending.length > 0 && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
              Esta cuenta tiene cambios sin enviar. Espera a que se sincronicen antes de cobrar:
              el total todavía puede cambiar.
            </p>
          )}
          <CheckoutPanel
            order={order}
            maxDiscountPercentage={maxDiscountPercentage}
            onSettled={reload}
          />
        </>
      ) : (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-4 text-sm">
          <p className="font-medium text-warning">Sin conexión: no se puede cobrar</p>
          <p className="mt-1 text-muted-foreground">
            Un cobro necesita el total real de la cuenta, y puede haber cambiado desde otro
            dispositivo. El cobro vuelve solo en cuanto se recupere la conexión.
          </p>
          <p className="mt-3 flex items-baseline justify-between font-medium">
            <span>Total de esta cuenta</span>
            <span className="text-lg tabular-nums">{formatPrice(order.total)}</span>
          </p>
        </div>
      )}

      <RealtimeInvalidator
        events={['order:changed']}
        collection={COLLECTIONS.orders}
        path={`/orders/${orderId}`}
        single
      />
    </>
  );
}
