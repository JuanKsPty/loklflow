'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { TableStatus } from '@loklflow/types';
import { tablesApi } from '@/lib/api/tables.api';
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
  const router = useRouter();
  const [pending, setPending] = useState<TableStatus | null>(null);

  async function change(status: TableStatus) {
    if (status === current) return;
    setPending(status);
    try {
      await tablesApi.updateStatus(tableId, status);
      toast.success(`Mesa ${TABLE_STATUS_LABELS[status].toLowerCase()}`);
      router.refresh();
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
          size="sm"
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
