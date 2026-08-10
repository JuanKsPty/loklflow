import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { isNotFound, serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { getServerUser } from '@/lib/auth/server-user';
import { Button } from '@/components/ui/button';
import { OrderDetailView } from '@/components/waiter/order-detail-view';
import type { Order, Product } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Cascarón de servidor: pide, y deja que la vista decida qué enseñar.
 *
 * El `notFound()` se conserva para el 404 —esa cuenta de verdad no existe—, pero cualquier otro
 * fallo ya no pinta un cartel: se pasa `null` y la vista arranca con la cuenta que el
 * dispositivo tenía guardada, que es lo que el mesero necesita durante un corte.
 */
export default async function WaiterOrderPage({ params }: Props) {
  const { id } = await params;

  let order: Order | null = null;
  let products: Product[] | null = null;
  let maxDiscountPercentage = 0;

  try {
    const [fetchedOrder, fetchedProducts, user] = await Promise.all([
      serverFetch<Order>(`/orders/${id}`),
      serverFetch<Product[]>('/menu/products'),
      getServerUser(),
    ]);
    order = fetchedOrder;
    products = fetchedProducts;
    maxDiscountPercentage = user?.maxDiscountPercentage ?? 0;
  } catch (err) {
    if (isNotFound(err)) notFound();
    reportApiFailure('waiter/orden', err);
  }

  const backHref = order?.tableId ? `/waiter/mesa/${order.tableId}` : '/waiter/ordenes';

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        nativeButton={false}
        render={<Link href={backHref} />}
      >
        <ChevronLeftIcon />
        Volver
      </Button>
      <OrderDetailView
        orderId={id}
        initialOrder={order}
        initialProducts={products}
        maxDiscountPercentage={maxDiscountPercentage}
      />
    </div>
  );
}
