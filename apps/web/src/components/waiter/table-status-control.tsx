'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { TableStatus } from '@loklflow/types';
import { updateTableStatus } from '@/lib/api/tables.offline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TABLE_STATUS_LABELS } from '@/components/admin/tables/constants';

// Estados que el mesero alterna desde el piso.
const QUICK_STATUSES: TableStatus[] = ['available', 'occupied', 'cleaning'];

export function TableStatusControl({
  tableId,
  current,
}: {
  tableId: string;
  current: TableStatus;
}) {
  const [pending, setPending] = useState<TableStatus | null>(null);

  /**
   * No hay `router.refresh()`: la vista lee de la copia local y superpone la cola, así que el
   * cambio se ve solo. Refrescar aquí reejecutaría el Server Component, que sin red falla y
   * encima resembraría la pantalla con los datos anteriores al toque.
   */
  async function change(status: TableStatus) {
    if (status === current) return;
    setPending(status);
    try {
      const result = await updateTableStatus(tableId, status);
      if (result.outcome === 'rejected') {
        toast.error(result.reason);
      } else if (result.outcome === 'queued') {
        toast.success(`Mesa ${TABLE_STATUS_LABELS[status].toLowerCase()} · se enviará al volver la conexión`);
      } else {
        toast.success(`Mesa ${TABLE_STATUS_LABELS[status].toLowerCase()}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex gap-2">
      {QUICK_STATUSES.map((status) => (
        <Button
          key={status}
          variant={status === current ? 'default' : 'outline'}
          size="touch"
          className={cn('flex-1', pending && 'pointer-events-none')}
          disabled={pending !== null}
          onClick={() => change(status)}
        >
          {pending === status && <Spinner />}
          {TABLE_STATUS_LABELS[status]}
        </Button>
      ))}
    </div>
  );
}
