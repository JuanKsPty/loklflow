import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { OrderTable } from '@/components/admin/orders/order-table';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import type { Order } from '@loklflow/types';

export const metadata = { title: 'Órdenes — LoklFlow' };

export default async function OrdersPage() {
  let orders: Order[] = [];
  try {
    orders = await serverFetch<Order[]>('/orders');
  } catch {
    // muestra lista vacía si la API no está disponible
  }

  return (
    <div>
      <PageHeader
        title="Órdenes"
        description="Crea órdenes y sigue su flujo de estados."
        action={
          <Button nativeButton={false} render={<Link href="/admin/orders/new" />}>
            <PlusIcon />
            Nueva orden
          </Button>
        }
      />
      <OrderTable orders={orders} />
      <RealtimeRefresher events={['order:changed']} toastOnNewOrder />
    </div>
  );
}
