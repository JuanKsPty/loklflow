import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { Button } from '@/components/ui/button';
import { MobileOrderBuilder } from '@/components/waiter/mobile-order-builder';
import type { Modifier, Product, RestaurantTable } from '@loklflow/types';

interface Props {
  searchParams: Promise<{ tableId?: string }>;
}

export default async function WaiterNewOrderPage({ searchParams }: Props) {
  const { tableId } = await searchParams;

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
    // catálogos vacíos si la API no responde
  }

  const backHref = tableId ? `/waiter/mesa/${tableId}` : '/waiter';

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href={backHref} />}>
        <ChevronLeftIcon />
        Volver
      </Button>
      <h1 className="mb-4 text-xl font-semibold">Tomar orden</h1>
      <MobileOrderBuilder
        tables={tables}
        products={products.filter((p) => p.isActive)}
        modifiers={modifiers}
        defaultTableId={tableId}
      />
    </div>
  );
}
