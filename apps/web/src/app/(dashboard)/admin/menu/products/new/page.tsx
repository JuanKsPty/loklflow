import { serverFetch } from '@/lib/api/server-client';
import { ProductForm } from '@/components/admin/menu/product-form';
import { PageHeader } from '@/components/page-header';
import type { Category, Modifier } from '@loklflow/types';

export const metadata = { title: 'Nuevo producto — LoklFlow' };

export default async function NewProductPage() {
  let categories: Category[] = [];
  let modifiers: Modifier[] = [];
  try {
    [categories, modifiers] = await Promise.all([
      serverFetch<Category[]>('/menu/categories'),
      serverFetch<Modifier[]>('/menu/modifiers'),
    ]);
  } catch {
    // formulario sin catálogos si la API no responde
  }

  return (
    <div>
      <PageHeader title="Nuevo producto" description="Agrega un producto al menú." />
      <ProductForm categories={categories} modifiers={modifiers} />
    </div>
  );
}
