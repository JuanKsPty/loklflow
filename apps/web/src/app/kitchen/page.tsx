import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { KdsBoard } from '@/components/kitchen/kds-board';
import type { Order } from '@loklflow/types';

export default async function KitchenPage() {
  let orders: Order[] | null = null;
  try {
    orders = await serverFetch<Order[]>('/orders?open=true');
  } catch (err) {
    // Se registra igual, pero ya no decide la pantalla. Antes pintaba «Sin órdenes» en las tres
    // columnas y el cocinero concluía que no había nada que cocinar mientras las comandas se
    // acumulaban; ahora el tablero sigue enseñando lo último que supo.
    reportApiFailure('kitchen', err);
  }

  return (
    <div className="flex h-full flex-col">
      <KdsBoard initialOrders={orders} />
    </div>
  );
}
