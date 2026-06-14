import { serverFetch } from '@/lib/api/server-client';
import { OrderForm } from '@/components/admin/orders/order-form';
import { PageHeader } from '@/components/page-header';
import type { Modifier, Product, RestaurantTable } from '@loklflow/types';

export const metadata = { title: 'Nueva orden — LoklFlow' };

export default async function NewOrderPage() {
  let tables: RestaurantTable[] = [];
  let products: Product[] = [];
  let modifiers: Modifier[] = [];
  try {
    [tables, products, modifiers] = await Promise.all([
      serverFetch<RestaurantTable[]>('/tables'),
      serverFetch<Product[]>('/menu/products'),
      serverFetch<Modifier[]>('/menu/modifiers'),
    ]);
  } catch {
    // formulario con catálogos vacíos si la API no responde
  }

  return (
    <div>
      <PageHeader title="Nueva orden" description="Selecciona la mesa y agrega los productos." />
      <OrderForm tables={tables} products={products.filter((p) => p.isActive)} modifiers={modifiers} />
    </div>
  );
}
