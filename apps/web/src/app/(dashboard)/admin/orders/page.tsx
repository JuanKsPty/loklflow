import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { OrderTable } from '@/components/admin/orders/order-table';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import type { Order } from '@loklflow/types';

export const metadata = { title: 'Órdenes — LoklFlow' };

/** Tope de la API. Es el único listado que quiere histórico y no solo cuentas abiertas. */
const TAKE = 200;

export default async function OrdersPage() {
  let orders: Order[] = [];
  try {
    orders = await serverFetch<Order[]>(`/orders?take=${TAKE}`);
  } catch {
    // muestra lista vacía si la API no está disponible
  }

  // El tope se dice, no se esconde: sin este aviso la tabla parecería el histórico completo
  // en cuanto el negocio pase de 200 órdenes.
  const truncated = orders.length >= TAKE;

  return (
    <div>
      <PageHeader
        title="Órdenes"
        description={
          truncated
            ? `Crea órdenes y sigue su flujo de estados. Mostrando las ${TAKE} más recientes.`
            : 'Crea órdenes y sigue su flujo de estados.'
        }
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
