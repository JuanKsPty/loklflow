import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/lib/auth/server-user';
import { TablesTabs } from '@/components/admin/tables/tables-tabs';
import { TableFloorPlan } from '@/components/admin/tables/table-floor-plan';
import { BulkTablesDialog } from '@/components/admin/tables/bulk-tables-dialog';
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

  const canEdit = await hasPermission('tables:update');

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
        map={<TableFloorPlan sectors={sectors} tables={tables} canEdit={canEdit} />}
        tables={
          <>
            <div className="mb-3 flex justify-end gap-2">
              <BulkTablesDialog sectors={sectors} />
              <Button nativeButton={false} render={<Link href="/admin/tables/tables/new" />}>
                <PlusIcon />
                Nueva mesa
              </Button>
            </div>
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
