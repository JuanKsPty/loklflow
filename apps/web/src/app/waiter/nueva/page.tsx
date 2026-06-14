import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { Button } from '@/components/ui/button';
import { PosOrderBuilder } from '@/components/waiter/pos-order-builder';
import type { Category, Modifier, Product } from '@loklflow/types';

interface Props {
  searchParams: Promise<{ tableId?: string }>;
}

export default async function WaiterNewOrderPage({ searchParams }: Props) {
  const { tableId } = await searchParams;

  let categories: Category[] = [];
  let products: Product[] = [];
  let modifiers: Modifier[] = [];
  try {
    [categories, products, modifiers] = await Promise.all([
      serverFetch<Category[]>('/menu/categories'),
      serverFetch<Product[]>('/menu/products'),
      serverFetch<Modifier[]>('/menu/modifiers'),
    ]);
  } catch {
    // catálogos vacíos si la API no responde
  }

  const backHref = tableId ? `/waiter/mesa/${tableId}` : '/waiter';

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href={backHref} />}>
          <ChevronLeftIcon />
          Volver
        </Button>
        <h1 className="text-lg font-semibold">Nueva cuenta</h1>
      </div>
      <div className="min-h-0 flex-1">
        <PosOrderBuilder
          tableId={tableId}
          categories={categories.filter((c) => c.isActive)}
          products={products.filter((p) => p.isActive)}
          modifiers={modifiers}
        />
      </div>
    </div>
  );
}
