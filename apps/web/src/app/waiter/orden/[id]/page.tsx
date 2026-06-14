import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
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
    const [order, products] = await Promise.all([
      serverFetch<Order>(`/orders/${id}`),
      serverFetch<Product[]>('/menu/products'),
    ]);
    const backHref = order.tableId ? `/waiter/mesa/${order.tableId}` : '/waiter/ordenes';
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" nativeButton={false} render={<Link href={backHref} />}>
          <ChevronLeftIcon />
          Volver
        </Button>
        <MobileOrderDetail order={order} products={products.filter((p) => p.isActive)} />
        <RealtimeRefresher events={['order:changed']} />
      </div>
    );
  } catch {
    notFound();
  }
}
