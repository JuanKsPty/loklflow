import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { ModifierForm } from '@/components/admin/menu/modifier-form';
import { PageHeader } from '@/components/page-header';
import type { Modifier } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditModifierPage({ params }: Props) {
  const { id } = await params;
  try {
    const modifier = await serverFetch<Modifier>(`/menu/modifiers/${id}`);
    return (
      <div>
        <PageHeader title="Editar modificador" description={modifier.name} />
        <ModifierForm modifier={modifier} />
      </div>
    );
  } catch {
    notFound();
  }
}
