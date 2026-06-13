import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { CategoryForm } from '@/components/admin/menu/category-form';
import { PageHeader } from '@/components/page-header';
import type { Category } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  try {
    const category = await serverFetch<Category>(`/menu/categories/${id}`);
    return (
      <div>
        <PageHeader title="Editar categoría" description={category.name} />
        <CategoryForm category={category} />
      </div>
    );
  } catch {
    notFound();
  }
}
