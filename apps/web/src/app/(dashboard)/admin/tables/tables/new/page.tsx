import { serverFetch } from '@/lib/api/server-client';
import { TableForm } from '@/components/admin/tables/table-form';
import { PageHeader } from '@/components/page-header';
import type { Sector } from '@loklflow/types';

export const metadata = { title: 'Nueva mesa — LoklFlow' };

export default async function NewTablePage() {
  let sectors: Sector[] = [];
  try {
    sectors = await serverFetch<Sector[]>('/tables/sectors');
  } catch {
    // formulario sin sectores si la API no responde
  }

  return (
    <div>
      <PageHeader title="Nueva mesa" description="Agrega una mesa a un sector." />
      <TableForm sectors={sectors} />
    </div>
  );
}
