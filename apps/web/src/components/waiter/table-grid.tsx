import Link from 'next/link';
import type { RestaurantTable, Sector } from '@loklflow/types';
import { cn } from '@/lib/utils';
import {
  TABLE_STATUS_LABELS,
  TABLE_STATUS_MAP_CLASSES,
} from '@/components/admin/tables/constants';

interface Props {
  sectors: Sector[];
  tables: RestaurantTable[];
}

export function TableGrid({ sectors, tables }: Props) {
  const active = tables.filter((t) => t.isActive);
  const bySector = new Map<string, RestaurantTable[]>();
  for (const t of active) {
    const list = bySector.get(t.sectorId) ?? [];
    list.push(t);
    bySector.set(t.sectorId, list);
  }

  if (active.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay mesas configuradas todavía.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sectors.map((sector) => {
        const sectorTables = (bySector.get(sector.id) ?? []).sort((a, b) => a.number - b.number);
        if (sectorTables.length === 0) return null;
        return (
          <section key={sector.id}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{sector.name}</h2>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {sectorTables.map((table) => (
                <Link
                  key={table.id}
                  href={`/waiter/mesa/${table.id}`}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center rounded-xl border-2 transition-colors',
                    TABLE_STATUS_MAP_CLASSES[table.status],
                  )}
                >
                  <span className="text-2xl font-bold">{table.number}</span>
                  <span className="mt-0.5 text-[10px] font-medium opacity-80">
                    {TABLE_STATUS_LABELS[table.status]}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
