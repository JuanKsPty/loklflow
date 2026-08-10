import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { Button } from '@/components/ui/button';
import { NewOrderView } from '@/components/waiter/new-order-view';
import type { Category, Modifier, Product } from '@loklflow/types';

interface Props {
  searchParams: Promise<{ tableId?: string }>;
}

export default async function WaiterNewOrderPage({ searchParams }: Props) {
  const { tableId } = await searchParams;

  let categories: Category[] | null = null;
  let products: Product[] | null = null;
  let modifiers: Modifier[] | null = null;
  try {
    [categories, products, modifiers] = await Promise.all([
      serverFetch<Category[]>('/menu/categories'),
      serverFetch<Product[]>('/menu/products'),
      serverFetch<Modifier[]>('/menu/modifiers'),
    ]);
  } catch (err) {
    // Se registra igual, pero ya no decide la pantalla: la vista tira del catálogo guardado en
    // el dispositivo, que es lo que permite tomar una comanda durante un corte.
    reportApiFailure('waiter/nueva', err);
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
        <NewOrderView
          tableId={tableId}
          initialCategories={categories}
          initialProducts={products}
          initialModifiers={modifiers}
        />
      </div>
    </div>
  );
}
