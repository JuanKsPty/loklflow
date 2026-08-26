import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { hasAnyFilter } from '@/lib/url';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { OrderTable } from '@/components/admin/orders/order-table';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import { FilterBar } from '@/components/admin/filters/filter-bar';
import { NoMatches } from '@/components/admin/filters/no-matches';
import { SearchField } from '@/components/admin/filters/search-field';
import type { Order } from '@loklflow/types';

export const metadata = { title: 'Órdenes — LoklFlow' };

/** Tope de la API. Es el único listado que quiere histórico y no solo cuentas abiertas. */
const TAKE = 200;

const BASE_PATH = '/admin/orders';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const { q: crudo } = await searchParams;
  // Una orden se busca por su número: el uuid no se teclea. Ver `numberLike` en la API.
  const q = crudo?.trim() || undefined;
  const params = { q };
  const hayFiltros = hasAnyFilter(params);

  const query = new URLSearchParams({ take: String(TAKE) });
  if (q) query.set('q', q);

  let orders: Order[] = [];
  try {
    orders = await serverFetch<Order[]>(`/orders?${query.toString()}`);
  } catch {
    // muestra lista vacía si la API no está disponible
  }

  // El tope se dice, no se esconde: sin este aviso la tabla parecería el histórico completo
  // en cuanto el negocio pase de 200 órdenes.
  const truncated = orders.length >= TAKE;

  return (
    <div>
      <PageHeader
        title="Órdenes"
        description={
          truncated
            ? `Crea órdenes y sigue su flujo de estados. Mostrando las ${TAKE} más recientes.`
            : 'Crea órdenes y sigue su flujo de estados.'
        }
        action={
          <Button nativeButton={false} render={<Link href="/admin/orders/new" />}>
            <PlusIcon />
            Nueva orden
          </Button>
        }
      />
      <FilterBar basePath={BASE_PATH}>
        <SearchField
          basePath={BASE_PATH}
          params={params}
          defaultValue={q ?? ''}
          placeholder="Buscar por número de orden"
          label="Buscar una orden por su número"
        />
      </FilterBar>
      {hayFiltros && orders.length === 0 ? (
        <NoMatches basePath={BASE_PATH} what="órdenes" />
      ) : (
        <OrderTable orders={orders} />
      )}
      <RealtimeRefresher events={['order:changed']} toastOnNewOrder />
    </div>
  );
}
