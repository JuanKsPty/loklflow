import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { TableForm } from '@/components/admin/tables/table-form';
import { PageHeader } from '@/components/page-header';
import type { RestaurantTable, Sector } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTablePage({ params }: Props) {
  const { id } = await params;
  try {
    const [table, sectors] = await Promise.all([
      serverFetch<RestaurantTable>(`/tables/${id}`),
      serverFetch<Sector[]>('/tables/sectors'),
    ]);
    return (
      <div>
        <PageHeader title="Editar mesa" description={`Mesa ${table.number}`} />
        <TableForm table={table} sectors={sectors} />
      </div>
    );
  } catch {
    notFound();
  }
}
