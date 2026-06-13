import { serverFetch } from '@/lib/api/server-client';
import { ComboForm } from '@/components/admin/menu/combo-form';
import { PageHeader } from '@/components/page-header';
import type { Product } from '@loklflow/types';

export const metadata = { title: 'Nuevo combo — LoklFlow' };

export default async function NewComboPage() {
  let products: Product[] = [];
  try {
    products = await serverFetch<Product[]>('/menu/products');
  } catch {
    // formulario sin productos si la API no responde
  }

  return (
    <div>
      <PageHeader title="Nuevo combo" description="Agrupa productos en un paquete." />
      <ComboForm products={products} />
    </div>
  );
}
