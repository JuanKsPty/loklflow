import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { ComboForm } from '@/components/admin/menu/combo-form';
import { PageHeader } from '@/components/page-header';
import type { Combo, Product } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditComboPage({ params }: Props) {
  const { id } = await params;
  try {
    const [combo, products] = await Promise.all([
      serverFetch<Combo>(`/menu/combos/${id}`),
      serverFetch<Product[]>('/menu/products'),
    ]);
    return (
      <div>
        <PageHeader title="Editar combo" description={combo.name} />
        <ComboForm combo={combo} products={products} />
      </div>
    );
  } catch {
    notFound();
  }
}
