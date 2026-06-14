import { serverFetch } from '@/lib/api/server-client';
import { TableGrid } from '@/components/waiter/table-grid';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import type { RestaurantTable, Sector } from '@loklflow/types';

export default async function WaiterFloorPage() {
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

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Salón</h1>
      <TableGrid sectors={sectors} tables={tables} />
      <RealtimeRefresher events={['table:changed', 'order:changed']} />
    </div>
  );
}
