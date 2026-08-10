'use client';

import { useMemo } from 'react';
import type { RestaurantTable, Sector } from '@loklflow/types';
import { COLLECTIONS } from '@/lib/offline/cache';
import { useCachedCollection } from '@/lib/offline/use-cache';
import { usePendingOperations } from '@/lib/offline/use-outbox';
import { applyPendingToTables, pendingIds } from '@/lib/offline/apply-pending';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { TableGrid } from './table-grid';
import { WaiterFloorMap } from './waiter-floor-map';

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
}: {
  view: 'mapa' | 'lista';
  initialSectors: Sector[] | null;
  initialTables: RestaurantTable[] | null;
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

  // Superpone lo encolado: el mesero que marca una mesa ocupada sin red tiene que verla
  // ocupada, o vuelve a tocarla creyendo que no funcionó.
  const tables = useMemo(() => applyPendingToTables(cached, pending), [cached, pending]);

  const empty = tables.length === 0;

  return (
    <>
      {empty && initialTables === null ? (
        <ApiDownNotice what="el salón" reason="offline" />
      ) : view === 'mapa' ? (
        <div className="min-h-0 flex-1">
          <WaiterFloorMap sectors={sectors} tables={tables} />
        </div>
      ) : (
        <TableGrid sectors={sectors} tables={tables} />
      )}
      <RealtimeInvalidator
        events={['table:changed', 'order:changed']}
        collection={COLLECTIONS.tables}
        path="/tables"
      />
    </>
  );
}
