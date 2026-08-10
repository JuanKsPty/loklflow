'use client';

import { useMemo, useState } from 'react';
import { CombineIcon, XIcon } from 'lucide-react';
import type { Order, RestaurantTable, Sector } from '@loklflow/types';
import { COLLECTIONS } from '@/lib/offline/cache';
import { useCachedCollection, useHydrateWhenEmpty } from '@/lib/offline/use-cache';
import { usePendingOperations } from '@/lib/offline/use-outbox';
import { applyPendingToTables, pendingIds } from '@/lib/offline/apply-pending';
import { useConnectivity } from '@/components/offline/offline-provider';
import { Button } from '@/components/ui/button';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { TableGrid } from './table-grid';
import { WaiterFloorMap } from './waiter-floor-map';
import { MergeDialog } from './merge-dialog';

const CLOSED = new Set(['closed', 'cancelled']);

/**
 * El salón, leído del dispositivo.
 *
 * La ruta sigue siendo un Server Component: hace su `serverFetch` y pasa lo que trajo como
 * `initial`. Esta vista lo siembra en la copia local y **lee de ahí**, así que cuando el
 * servidor no contesta —`initial` llega a `null`— la pantalla arranca con el salón que el
 * mesero vio la última vez en lugar de con un cartel de error.
 *
 * `ApiDownNotice` solo aparece si además la copia local está vacía: sin servidor **y** sin nada
 * guardado no hay nada que enseñar, y ahí sí hay que decirlo.
 */
export function FloorView({
  view,
  initialSectors,
  initialTables,
  initialOrders,
}: {
  view: 'mapa' | 'lista';
  initialSectors: Sector[] | null;
  initialTables: RestaurantTable[] | null;
  initialOrders: Order[] | null;
}) {
  const sectors = useCachedCollection<Sector>(COLLECTIONS.sectors, initialSectors);
  const pending = usePendingOperations();
  const protect = useMemo(() => pendingIds(pending, 'table'), [pending]);
  const cached = useCachedCollection<RestaurantTable>(
    COLLECTIONS.tables,
    initialTables,
    'replace',
    protect,
  );
  // Las cuentas hacen falta para saber qué mesas tienen algo que fusionar.
  const orders = useCachedCollection<Order>(COLLECTIONS.orders, initialOrders, 'merge');
  const { online } = useConnectivity();

  useHydrateWhenEmpty(COLLECTIONS.tables, '/tables');
  useHydrateWhenEmpty(COLLECTIONS.sectors, '/tables/sectors');

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  // Superpone lo encolado: el mesero que marca una mesa ocupada sin red tiene que verla
  // ocupada, o vuelve a tocarla creyendo que no funcionó.
  const tables = useMemo(() => applyPendingToTables(cached, pending), [cached, pending]);

  function toggle(tableId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  const selectedTables = tables.filter((t) => selected.has(t.id));
  const mergeableCount = orders.filter(
    (o) => o.tableId && selected.has(o.tableId) && !CLOSED.has(o.status) && !o.mergedIntoOrderId,
  ).length;

  const empty = tables.length === 0;

  return (
    <>
      {/* Fusionar exige conexión: mueve dinero entre cuentas y necesita ver el estado real de
          todas. `queueable.ts` no lo difiere, así que el botón desaparece en vez de ofrecer algo
          que va a fallar. */}
      {online && !empty && (
        <div className="mb-3 flex justify-end">
          {selecting ? (
            <Button variant="ghost" size="sm" onClick={exitSelection}>
              <XIcon />
              Cancelar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSelecting(true)}>
              <CombineIcon />
              Fusionar mesas
            </Button>
          )}
        </div>
      )}

      {empty && initialTables === null ? (
        <ApiDownNotice what="el salón" reason="offline" />
      ) : view === 'mapa' ? (
        <div className="min-h-0 flex-1">
          <WaiterFloorMap
            sectors={sectors}
            tables={tables}
            selecting={selecting}
            selected={selected}
            onToggle={toggle}
          />
        </div>
      ) : (
        <TableGrid
          sectors={sectors}
          tables={tables}
          selecting={selecting}
          selected={selected}
          onToggle={toggle}
        />
      )}

      {selecting && selected.size > 0 && (
        // Barra fija abajo, donde llega el pulgar, y con hueco para el indicador de inicio.
        <div className="fixed inset-x-0 bottom-16 z-10 px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-5xl">
            <Button
              className="h-12 w-full"
              disabled={mergeableCount < 2}
              onClick={() => setConfirming(true)}
            >
              <CombineIcon />
              {mergeableCount < 2
                ? 'Elige dos mesas con cuenta abierta'
                : `Fusionar ${mergeableCount} cuentas`}
            </Button>
          </div>
        </div>
      )}

      <MergeDialog
        open={confirming}
        onOpenChange={setConfirming}
        tables={selectedTables}
        orders={orders}
        onDone={exitSelection}
      />

      <RealtimeInvalidator
        events={['table:changed', 'order:changed']}
        collection={COLLECTIONS.tables}
        path="/tables"
      />
      <RealtimeInvalidator
        events={['order:changed']}
        collection={COLLECTIONS.orders}
        path="/orders?open=true"
      />
    </>
  );
}
