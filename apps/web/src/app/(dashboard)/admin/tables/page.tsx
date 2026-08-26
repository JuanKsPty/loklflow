import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { buildHref, hasAnyFilter } from '@/lib/url';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/lib/auth/server-user';
import { TablesTabs } from '@/components/admin/tables/tables-tabs';
import { TableFloorPlan } from '@/components/admin/tables/table-floor-plan';
import { BulkTablesDialog } from '@/components/admin/tables/bulk-tables-dialog';
import { TableList } from '@/components/admin/tables/table-table';
import { SectorTable } from '@/components/admin/tables/sector-table';
import { ReservationTable } from '@/components/admin/tables/reservation-table';
import { QrSheet } from '@/components/admin/tables/qr-sheet';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import { FilterBar } from '@/components/admin/filters/filter-bar';
import { NoMatches } from '@/components/admin/filters/no-matches';
import { SearchField } from '@/components/admin/filters/search-field';
import { SelectFilter } from '@/components/admin/filters/select-filter';
import type { Reservation, RestaurantTable, Sector } from '@loklflow/types';

export const metadata = { title: 'Mesas — LoklFlow' };

const TABS = ['map', 'tables', 'sectors', 'reservations', 'qr'] as const;
type Tab = (typeof TABS)[number];

const BASE_PATH = '/admin/tables';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; sectorId?: string }>;
}

export default async function TablesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const active: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'map';
  const q = sp.q?.trim() || undefined;
  const sectorId = UUID.test(sp.sectorId ?? '') ? sp.sectorId : undefined;

  const canEdit = await hasPermission('tables:update');

  const filtros =
    active === 'tables' ? { q, sectorId } : active === 'reservations' ? { q } : {};
  const hayFiltros = hasAnyFilter(filtros);
  const params = { tab: active, ...filtros };

  const consulta = (extra: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) if (v) query.set(k, v);
    const qs = query.toString();
    return qs ? `?${qs}` : '';
  };

  let sectors: Sector[] = [];
  let tables: RestaurantTable[] = [];
  let reservations: Reservation[] = [];
  try {
    [sectors, tables, reservations] = await Promise.all([
      // Los sectores alimentan el plano y el desplegable de la pestaña Mesas: solo se filtran
      // cuando la pestaña de sectores es la que está delante.
      serverFetch<Sector[]>(
        `/tables/sectors${active === 'sectors' ? consulta({ q }) : ''}`,
      ),
      // Igual con las mesas: el plano del salón y la hoja de QR las quieren todas.
      serverFetch<RestaurantTable[]>(
        `/tables${active === 'tables' ? consulta({ q, sectorId }) : ''}`,
      ),
      serverFetch<Reservation[]>(
        `/tables/reservations${active === 'reservations' ? consulta({ q }) : ''}`,
      ),
    ]);
  } catch {
    // muestra vistas vacías si la API no está disponible
  }

  const vacioPorFiltro = (n: number) => hayFiltros && n === 0;

  return (
    <div>
      <PageHeader title="Mesas y sectores" description="Salón, estados de mesa y reservas." />

      <TablesTabs
        initial={active}
        map={<TableFloorPlan sectors={sectors} tables={tables} canEdit={canEdit} />}
        tables={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'tables' }}
              right={
                <>
                  <BulkTablesDialog sectors={sectors} />
                  <Button nativeButton={false} render={<Link href="/admin/tables/tables/new" />}>
                    <PlusIcon />
                    Nueva mesa
                  </Button>
                </>
              }
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar por número"
                label="Buscar una mesa por su número"
              />
              {sectors.length > 0 && (
                <SelectFilter
                  basePath={BASE_PATH}
                  params={params}
                  name="sectorId"
                  label="Filtrar por sector"
                  value={sectorId}
                  allLabel="Todos los sectores"
                  options={sectors.map((sec) => ({ value: sec.id, label: sec.name }))}
                />
              )}
            </FilterBar>
            {vacioPorFiltro(tables.length) ? (
              <NoMatches basePath={buildHref(BASE_PATH, { tab: 'tables' })} what="mesas" />
            ) : (
              <TableList tables={tables} />
            )}
          </>
        }
        sectors={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'sectors' }}
              right={
                <Button nativeButton={false} render={<Link href="/admin/tables/sectors/new" />}>
                  <PlusIcon />
                  Nuevo sector
                </Button>
              }
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar un sector"
                label="Buscar un sector por su nombre"
              />
            </FilterBar>
            {vacioPorFiltro(sectors.length) ? (
              <NoMatches basePath={buildHref(BASE_PATH, { tab: 'sectors' })} what="sectores" />
            ) : (
              <SectorTable sectors={sectors} />
            )}
          </>
        }
        reservations={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'reservations' }}
              right={
                <Button
                  nativeButton={false}
                  render={<Link href="/admin/tables/reservations/new" />}
                >
                  <PlusIcon />
                  Nueva reserva
                </Button>
              }
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar por nombre"
                label="Buscar una reserva por el nombre de quien reservó"
              />
            </FilterBar>
            {vacioPorFiltro(reservations.length) ? (
              <NoMatches basePath={buildHref(BASE_PATH, { tab: 'reservations' })} what="reservas" />
            ) : (
              <ReservationTable reservations={reservations} />
            )}
          </>
        }
        qr={<QrSheet tables={tables} />}
      />
      <RealtimeRefresher events={['table:changed', 'order:changed']} />
    </div>
  );
}
