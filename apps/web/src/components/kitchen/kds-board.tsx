'use client';

import { useMemo } from 'react';
import type { Order, OrderStatus } from '@loklflow/types';
import { COLLECTIONS } from '@/lib/offline/cache';
import { useCachedCollection } from '@/lib/offline/use-cache';
import { usePendingOperations } from '@/lib/offline/use-outbox';
import { applyPendingToOrders, byPartition, pendingIds } from '@/lib/offline/apply-pending';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { KdsColumn } from './kds-column';

const at = (iso: string) => new Date(iso).getTime();

// Títulos en plural para el tablero (las constantes de estado son en singular).
const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: 'pending', title: 'Pendientes' },
  { status: 'preparing', title: 'En preparación' },
  { status: 'ready', title: 'Listas' },
];

/**
 * El tablero de cocina, leído del dispositivo.
 *
 * De las tres superficies operativas es la que peor aguantaba un corte: la pantalla de pared
 * pintaba «Sin órdenes» en las tres columnas y el cocinero concluía que no había nada que
 * cocinar mientras las comandas se acumulaban. Con la copia local sigue enseñando el tablero, y
 * los cambios de estado que toque durante el corte se ven aplicados y salen al reconectar.
 *
 * Todo lo que la cocina hace —`preparing`, `ready`— es encolable por diseño: son hechos que
 * describen trabajo ya realizado y no dependen de un estado que este dispositivo no pueda
 * conocer. Así que el KDS es, de hecho, la pantalla que funciona más completa sin red.
 */
export function KdsBoard({ initialOrders }: { initialOrders: Order[] | null }) {
  const pending = usePendingOperations();
  const protect = useMemo(() => pendingIds(pending, 'order'), [pending]);
  const cached = useCachedCollection<Order>(COLLECTIONS.orders, initialOrders, 'replace', protect);
  const groups = useMemo(() => byPartition(pending), [pending]);

  const sorted = useMemo(
    () =>
      applyPendingToOrders(cached, groups)
        // Solo órdenes con algún ítem de cocina; lo más viejo primero para priorizar.
        .filter((o) => (o.items ?? []).some((i) => i.product?.station === 'kitchen'))
        // Por la hora del hecho, no la del registro: una comanda tomada durante un corte y
        // sincronizada al volver el WiFi tiene que ir en su sitio en la fila, no al final.
        .sort((a, b) => at(a.occurredAt ?? a.createdAt) - at(b.occurredAt ?? b.createdAt)),
    [cached, groups],
  );

  if (sorted.length === 0 && cached.length === 0 && initialOrders === null) {
    return (
      <>
        <ApiDownNotice what="las órdenes" reason="offline" className="my-auto border" />
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
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map(({ status, title }) => (
          <KdsColumn
            key={status}
            title={title}
            orders={sorted.filter((o) => o.status === status)}
          />
        ))}
      </div>
      <RealtimeInvalidator
        events={['order:changed']}
        collection={COLLECTIONS.orders}
        path="/orders?open=true"
        toastOnNewOrder
      />
    </>
  );
}
