import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { TablesTabs } from '@/components/admin/tables/tables-tabs';
import { TableMap } from '@/components/admin/tables/table-map';
import { TableList } from '@/components/admin/tables/table-table';
import { SectorTable } from '@/components/admin/tables/sector-table';
import { ReservationTable } from '@/components/admin/tables/reservation-table';
import type { Reservation, RestaurantTable, Sector } from '@loklflow/types';

export const metadata = { title: 'Mesas — LoklFlow' };

const TABS = ['map', 'tables', 'sectors', 'reservations'] as const;
type Tab = (typeof TABS)[number];

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

function TabAction({ href, label }: { href: string; label: string }) {
  return (
    <div className="mb-3 flex justify-end">
      <Button nativeButton={false} render={<Link href={href} />}>
        <PlusIcon />
        {label}
      </Button>
    </div>
  );
}

export default async function TablesPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'map';

  let sectors: Sector[] = [];
  let tables: RestaurantTable[] = [];
  let reservations: Reservation[] = [];
  try {
    [sectors, tables, reservations] = await Promise.all([
      serverFetch<Sector[]>('/tables/sectors'),
      serverFetch<RestaurantTable[]>('/tables'),
      serverFetch<Reservation[]>('/tables/reservations'),
    ]);
  } catch {
    // muestra vistas vacías si la API no está disponible
  }

  return (
    <div>
      <PageHeader title="Mesas y sectores" description="Salón, estados de mesa y reservas." />

      <TablesTabs
        initial={active}
        map={<TableMap sectors={sectors} tables={tables} />}
        tables={
          <>
            <TabAction href="/admin/tables/tables/new" label="Nueva mesa" />
            <TableList tables={tables} />
          </>
        }
        sectors={
          <>
            <TabAction href="/admin/tables/sectors/new" label="Nuevo sector" />
            <SectorTable sectors={sectors} />
          </>
        }
        reservations={
          <>
            <TabAction href="/admin/tables/reservations/new" label="Nueva reserva" />
            <ReservationTable reservations={reservations} />
          </>
        }
      />
    </div>
  );
}
