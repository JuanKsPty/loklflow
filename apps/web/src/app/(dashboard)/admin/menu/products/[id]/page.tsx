import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { ProductForm } from '@/components/admin/menu/product-form';
import { PageHeader } from '@/components/page-header';
import type { Category, Modifier, Product } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  try {
    const [product, categories, modifiers] = await Promise.all([
      serverFetch<Product>(`/menu/products/${id}`),
      serverFetch<Category[]>('/menu/categories'),
      serverFetch<Modifier[]>('/menu/modifiers'),
    ]);
    return (
      <div>
        <PageHeader title="Editar producto" description={product.name} />
        <ProductForm product={product} categories={categories} modifiers={modifiers} />
      </div>
    );
  } catch {
    notFound();
  }
}
