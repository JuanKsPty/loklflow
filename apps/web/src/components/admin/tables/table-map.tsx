'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UsersIcon, LayoutGridIcon } from 'lucide-react';
import { TABLE_STATUSES, type RestaurantTable, type Sector, type TableStatus } from '@loklflow/types';
import { tablesApi } from '@/lib/api/tables.api';
import { TABLE_STATUS_LABELS, TABLE_STATUS_MAP_CLASSES } from './constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

interface Props {
  sectors: Sector[];
  tables: RestaurantTable[];
}

export function TableMap({ sectors, tables }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function changeStatus(table: RestaurantTable, status: TableStatus) {
    if (status === table.status) return;
    setPendingId(table.id);
    try {
      await tablesApi.updateStatus(table.id, status);
      toast.success(`Mesa ${table.number}: ${TABLE_STATUS_LABELS[status]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar el estado');
    } finally {
      setPendingId(null);
    }
  }

  if (tables.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutGridIcon />
          </EmptyMedia>
          <EmptyTitle>Sin mesas</EmptyTitle>
          <EmptyDescription>Crea sectores y mesas para verlas en el mapa.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const sectorsWithTables = sectors
    .map((sector) => ({ sector, items: tables.filter((t) => t.sectorId === sector.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {sectorsWithTables.map(({ sector, items }) => (
        <div key={sector.id}>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{sector.name}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((table) => (
              <DropdownMenu key={table.id}>
                <DropdownMenuTrigger
                  disabled={pendingId === table.id}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-4 transition-colors disabled:opacity-50 ${TABLE_STATUS_MAP_CLASSES[table.status]}`}
                >
                  <span className="text-lg font-bold">{table.number}</span>
                  <span className="flex items-center gap-1 text-xs">
                    <UsersIcon className="size-3" />
                    {table.capacity}
                  </span>
                  <span className="text-[11px] font-medium">{TABLE_STATUS_LABELS[table.status]}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Mesa {table.number} — cambiar estado</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {TABLE_STATUSES.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      disabled={status === table.status}
                      onClick={() => changeStatus(table, status)}
                    >
                      {TABLE_STATUS_LABELS[status]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
