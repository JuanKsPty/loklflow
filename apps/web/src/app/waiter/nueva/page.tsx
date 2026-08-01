import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
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
  let apiDown = false;
  try {
    [categories, products, modifiers] = await Promise.all([
      serverFetch<Category[]>('/menu/categories'),
      serverFetch<Product[]>('/menu/products'),
      serverFetch<Modifier[]>('/menu/modifiers'),
    ]);
  } catch {
    // Antes esto mostraba «Sin productos.», como si el menú estuviera vacío.
    apiDown = true;
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
        {apiDown ? (
          <ApiDownNotice what="el menú" />
        ) : (
          <PosOrderBuilder
            tableId={tableId}
            categories={categories.filter((c) => c.isActive)}
            products={products.filter((p) => p.isActive)}
            modifiers={modifiers}
          />
        )}
      </div>
    </div>
  );
}
