import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { isNotFound, serverFetch } from '@/lib/api/server-client';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { getServerUser } from '@/lib/auth/server-user';
import { Button } from '@/components/ui/button';
import { MobileOrderDetail } from '@/components/waiter/mobile-order-detail';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import type { Order, Product } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WaiterOrderPage({ params }: Props) {
  const { id } = await params;
  try {
    const [order, products, user] = await Promise.all([
      serverFetch<Order>(`/orders/${id}`),
      serverFetch<Product[]>('/menu/products'),
      getServerUser(),
    ]);
    const backHref = order.tableId ? `/waiter/mesa/${order.tableId}` : '/waiter/ordenes';
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href={backHref} />}>
          <ChevronLeftIcon />
          Volver
        </Button>
        <MobileOrderDetail
          order={order}
          products={products.filter((p) => p.isActive)}
          maxDiscountPercentage={user?.maxDiscountPercentage ?? 0}
        />
        <RealtimeRefresher events={['order:changed']} />
      </div>
    );
  } catch (err) {
    // Solo un 404 significa que la cuenta no existe; lo demás es que no pudimos preguntar.
    if (isNotFound(err)) notFound();
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href="/waiter/ordenes" />}>
          <ChevronLeftIcon />
          Volver
        </Button>
        <ApiDownNotice what="la cuenta" />
      </div>
    );
  }
}
