'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import type { Order, RestaurantTable } from '@loklflow/types';
import { COLLECTIONS } from '@/lib/offline/cache';
import { useCachedCollection, useCachedRow } from '@/lib/offline/use-cache';
import { usePendingOperations } from '@/lib/offline/use-outbox';
import { applyPendingToOrders, applyPendingToTables, byPartition } from '@/lib/offline/apply-pending';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { PendingBadge } from '@/components/offline/pending-badge';
import { RealtimeInvalidator } from '@/components/realtime/realtime-invalidator';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';
import { TABLE_STATUS_LABELS } from '@/components/admin/tables/constants';
import { TableStatusControl } from './table-status-control';

const CLOSED = new Set(['closed', 'cancelled']);

/**
 * Una mesa y sus cuentas, leídas del dispositivo.
 *
 * La lista de cuentas se filtra **de la copia local completa** por `tableId`, y no de una
 * consulta al servidor por mesa. Es lo que permite que abra sin red: el listado del salón ya
 * dejó las cuentas guardadas, y pedirlas otra vez por mesa sería depender de una petición que
 * sin conexión no existe.
 */
export function TableView({
  tableId,
  initialTable,
  initialOrders,
}: {
  tableId: string;
  initialTable: RestaurantTable | null;
  initialOrders: Order[] | null;
}) {
  const cachedTable = useCachedRow<RestaurantTable>(COLLECTIONS.tables, tableId, initialTable);
  // `merge`: son las cuentas de **esta** mesa, no la colección entera. Con `replace` se
  // borrarían de la copia local las de todas las demás.
  const cachedOrders = useCachedCollection<Order>(COLLECTIONS.orders, initialOrders, 'merge');
  const pending = usePendingOperations();
  const groups = useMemo(() => byPartition(pending), [pending]);

  const table = useMemo(
    () => (cachedTable ? applyPendingToTables([cachedTable], pending)[0] : undefined),
    [cachedTable, pending],
  );

  const accounts = useMemo(
    () =>
      applyPendingToOrders(
        cachedOrders.filter((o) => o.tableId === tableId && !CLOSED.has(o.status)),
        groups,
      ).sort((a, b) => a.orderNumber - b.orderNumber),
    [cachedOrders, groups, tableId],
  );

  if (!table) {
    return <ApiDownNotice what="la mesa" reason={initialTable === null ? 'offline' : 'error'} />;
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Mesa {table.number}</h1>
          <div className="flex items-center gap-2">
            <PendingBadge partition={`table:${table.id}`} />
            <Badge variant="outline">{TABLE_STATUS_LABELS[table.status]}</Badge>
          </div>
        </div>
        {table.sector && (
          <p className="text-sm text-muted-foreground">
            {table.sector.name} · {table.capacity} personas
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Estado de la mesa</p>
        <TableStatusControl tableId={table.id} current={table.status} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Cuentas {accounts.length > 0 && `(${accounts.length})`}
          </p>
          <Button size="sm" nativeButton={false} render={<Link href={`/waiter/nueva?tableId=${table.id}`} />}>
            <PlusIcon />
            Nueva cuenta
          </Button>
        </div>

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">No hay cuentas abiertas en esta mesa.</p>
              <Button nativeButton={false} render={<Link href={`/waiter/nueva?tableId=${table.id}`} />}>
                <PlusIcon />
                Tomar orden
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {accounts.map((account) => (
              <Link key={account.id} href={`/waiter/orden/${account.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {account.label || `Cuenta #${account.orderNumber}`}
                      </p>
                      {account.label && (
                        <p className="text-xs text-muted-foreground">#{account.orderNumber}</p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(account.items ?? []).length} ítem(s) · {formatPrice(account.total)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className={ORDER_STATUS_BADGE[account.status]}>
                        {ORDER_STATUS_LABELS[account.status]}
                      </Badge>
                      <PendingBadge partition={`order:${account.id}`} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

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
