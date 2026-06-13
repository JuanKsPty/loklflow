import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { SectorForm } from '@/components/admin/tables/sector-form';
import { PageHeader } from '@/components/page-header';
import type { Sector } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSectorPage({ params }: Props) {
  const { id } = await params;
  try {
    const sector = await serverFetch<Sector>(`/tables/sectors/${id}`);
    return (
      <div>
        <PageHeader title="Editar sector" description={sector.name} />
        <SectorForm sector={sector} />
      </div>
    );
  } catch {
    notFound();
  }
}
