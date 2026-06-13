import { serverFetch } from '@/lib/api/server-client';
import { TableForm } from '@/components/admin/tables/table-form';
import { PageHeader } from '@/components/page-header';
import type { RestaurantTable, Sector } from '@loklflow/types';

export const metadata = { title: 'Nueva mesa — LoklFlow' };

export default async function NewTablePage() {
  let sectors: Sector[] = [];
  let nextNumber = 1;
  try {
    const [sectorsRes, tables] = await Promise.all([
      serverFetch<Sector[]>('/tables/sectors'),
      serverFetch<RestaurantTable[]>('/tables'),
    ]);
    sectors = sectorsRes;
    nextNumber = tables.reduce((max, t) => Math.max(max, t.number), 0) + 1;
  } catch {
    // formulario con valores por defecto si la API no responde
  }

  return (
    <div>
      <PageHeader title="Nueva mesa" description="Agrega una mesa a un sector." />
      <TableForm sectors={sectors} defaultNumber={nextNumber} />
    </div>
  );
}
