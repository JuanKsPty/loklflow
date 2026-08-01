import { serverFetch } from '@/lib/api/server-client';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { KdsColumn } from '@/components/kitchen/kds-column';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';
import type { Order, OrderStatus } from '@loklflow/types';

// Títulos en plural para el tablero (las constantes de estado son en singular).
const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: 'pending', title: 'Pendientes' },
  { status: 'preparing', title: 'En preparación' },
  { status: 'ready', title: 'Listas' },
];

export default async function KitchenPage() {
  let orders: Order[] = [];
  let apiDown = false;
  try {
    orders = await serverFetch<Order[]>('/orders?open=true');
  } catch {
    // Antes esto pintaba el tablero con «Sin órdenes» en las tres columnas, y el cocinero
    // concluía que no había nada que cocinar mientras las comandas se acumulaban.
    apiDown = true;
  }

  if (apiDown) {
    return (
      <div className="flex h-full flex-col">
        <ApiDownNotice what="las órdenes" className="my-auto border" />
        <RealtimeRefresher events={['order:changed']} />
      </div>
    );
  }

  // Solo órdenes con algún ítem de cocina; lo más viejo primero para priorizar.
  const sorted = [...orders]
    .filter((o) => (o.items ?? []).some((i) => i.product?.station === 'kitchen'))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const byStatus = (status: OrderStatus) => sorted.filter((o) => o.status === status);

  return (
    <div className="flex h-full flex-col">
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map(({ status, title }) => (
          <KdsColumn key={status} title={title} orders={byStatus(status)} />
        ))}
      </div>
      <RealtimeRefresher events={['order:changed']} toastOnNewOrder />
    </div>
  );
}
