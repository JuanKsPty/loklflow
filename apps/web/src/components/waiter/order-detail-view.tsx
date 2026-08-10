'use client';

import { useCallback, useMemo } from 'react';
import type { Order, Product } from '@loklflow/types';
import { api } from '@/lib/api/client';
import { COLLECTIONS, putMany } from '@/lib/offline/cache';
import { useCachedCollection, useCachedRow, useHydrateWhenEmpty } from '@/lib/offline/use-cache';
import { usePendingFor } from '@/lib/offline/use-outbox';
import { applyPendingToOrder } from '@/lib/offline/apply-pending';
import { orderPartition } from '@/lib/api/orders.offline';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { MobileOrderDetail } from './mobile-order-detail';
import { MergedBanner } from './merged-banner';

/**
 * Una cuenta, leída del dispositivo.
 *
 * El catálogo de productos se guarda también en la copia local, y esa es la pieza que hace
 * posible **añadir** productos sin conexión: sin catálogo el mesero no tendría qué elegir, así
 * que la comanda se quedaría congelada en lo que ya tuviera. Es lo que menos cambia de todo lo
 * que la aplicación pide al servidor, así que guardarlo sale casi gratis.
 */
export function OrderDetailView({
  orderId,
  initialOrder,
  initialProducts,
  maxDiscountPercentage,
}: {
  orderId: string;
  initialOrder: Order | null;
  initialProducts: Product[] | null;
  maxDiscountPercentage: number;
}) {
  const cached = useCachedRow<Order>(COLLECTIONS.orders, orderId, initialOrder);
  const products = useCachedCollection<Product>(COLLECTIONS.products, initialProducts);
  const pending = usePendingFor(orderPartition(orderId));

  const order = useMemo(() => applyPendingToOrder(cached, pending), [cached, pending]);

  // Antes del `return` temprano: si el cascarón no trajo nada y el navegador sí puede pedir,
  // esta pantalla tiene que intentarlo, o se queda con el aviso de «sin conexión» para siempre.
  useHydrateWhenEmpty(COLLECTIONS.orders, `/orders/${orderId}`, orderId);
  useHydrateWhenEmpty(COLLECTIONS.products, '/menu/products');

  /**
   * Relee la cuenta del servidor. La usan las acciones que **solo** funcionan en línea —cobrar,
   * fijar propina, pedir descuento—, donde sí hay servidor por definición y el total resultante
   * tiene que venir de él.
   */
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
      {/* Antes del detalle: si la cuenta está fusionada, el mesero tiene que enterarse antes de
          preguntarse dónde están sus ítems. */}
      <MergedBanner order={order} />
      <MobileOrderDetail
        order={order}
        products={products.filter((p) => p.isActive)}
        maxDiscountPercentage={maxDiscountPercentage}
        onServerChange={reload}
      />
      <RealtimeInvalidator
        events={['order:changed']}
        collection={COLLECTIONS.orders}
        path={`/orders/${orderId}`}
        rowId={orderId}
      />
    </>
  );
}
