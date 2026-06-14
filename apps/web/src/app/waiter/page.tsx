import Link from 'next/link';
import { LayoutGridIcon, MapIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { cn } from '@/lib/utils';
import { TableGrid } from '@/components/waiter/table-grid';
import { WaiterFloorMap } from '@/components/waiter/waiter-floor-map';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import type { RestaurantTable, Sector } from '@loklflow/types';

interface Props {
  searchParams: Promise<{ view?: string }>;
}

const VIEWS = [
  { value: 'mapa', label: 'Mapa', icon: MapIcon, href: '/waiter' },
  { value: 'lista', label: 'Lista', icon: LayoutGridIcon, href: '/waiter?view=lista' },
];

function ViewToggle({ active }: { active: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold">Salón</h1>
      <div className="flex gap-1 rounded-lg border p-0.5">
        {VIEWS.map((v) => {
          const isActive = active === v.value;
          const Icon = v.icon;
          return (
            <Link
              key={v.value}
              href={v.href}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <Icon className="size-4" />
              {v.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function WaiterFloorPage({ searchParams }: Props) {
  const { view } = await searchParams;
  const active = view === 'lista' ? 'lista' : 'mapa';

  let sectors: Sector[] = [];
  let tables: RestaurantTable[] = [];
  try {
    [sectors, tables] = await Promise.all([
      serverFetch<Sector[]>('/tables/sectors'),
      serverFetch<RestaurantTable[]>('/tables'),
    ]);
  } catch {
    // salón vacío si la API no responde
  }

  if (active === 'mapa') {
    return (
      <div className="flex h-full flex-col">
        <ViewToggle active={active} />
        <div className="min-h-0 flex-1">
          <WaiterFloorMap sectors={sectors} tables={tables} />
        </div>
        <RealtimeRefresher events={['table:changed', 'order:changed']} />
      </div>
    );
  }

  return (
    <div>
      <ViewToggle active={active} />
      <TableGrid sectors={sectors} tables={tables} />
      <RealtimeRefresher events={['table:changed', 'order:changed']} />
    </div>
  );
}
