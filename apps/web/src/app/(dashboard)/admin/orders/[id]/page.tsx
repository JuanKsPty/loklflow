import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { OrderDetail } from '@/components/admin/orders/order-detail';
import { PageHeader } from '@/components/page-header';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import type { Order, Product } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  try {
    const [order, products] = await Promise.all([
      serverFetch<Order>(`/orders/${id}`),
      serverFetch<Product[]>('/menu/products'),
    ]);
    return (
      <div>
        <PageHeader
          title={`Orden #${order.orderNumber}`}
          description="Detalle, flujo de estados e ítems."
        />
        <OrderDetail order={order} products={products.filter((p) => p.isActive)} />
        <RealtimeRefresher events={['order:changed']} />
      </div>
    );
  } catch {
    notFound();
  }
}
