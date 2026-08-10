import Link from 'next/link';
import { LayoutGridIcon, MapIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { cn } from '@/lib/utils';
import { FloorView } from '@/components/waiter/floor-view';
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

/**
 * Cascarón de servidor. Pide los datos y se los pasa a la vista de cliente, que los siembra en
 * la copia local del dispositivo y lee de ahí.
 *
 * Cuando el servidor no contesta ya **no** se devuelve un cartel de error: se pasa `null` y la
 * vista arranca con el salón que el mesero vio la última vez. El aviso lo decide ella, y solo
 * si tampoco hay nada guardado.
 */
export default async function WaiterFloorPage({ searchParams }: Props) {
  const { view } = await searchParams;
  const active = view === 'lista' ? 'lista' : 'mapa';

  let sectors: Sector[] | null = null;
  let tables: RestaurantTable[] | null = null;
  try {
    [sectors, tables] = await Promise.all([
      serverFetch<Sector[]>('/tables/sectors'),
      serverFetch<RestaurantTable[]>('/tables'),
    ]);
  } catch (err) {
    // Se sigue registrando: que la pantalla aguante no significa que el fallo no exista.
    reportApiFailure('waiter', err);
  }

  return (
    <div className={active === 'mapa' ? 'flex h-full flex-col' : undefined}>
      <ViewToggle active={active} />
      <FloorView view={active} initialSectors={sectors} initialTables={tables} />
    </div>
  );
}
