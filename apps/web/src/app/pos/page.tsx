import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { PosAccountsView } from '@/components/pos/pos-accounts-view';
import type { Order, ShiftSummary } from '@loklflow/types';

export default async function PosPage() {
  /**
   * Las dos peticiones van en paralelo con `allSettled`, no con `all`.
   *
   * `all` rechaza con el primer fallo y perdería el resultado de la otra, y aquí las dos
   * alimentan lógicas distintas: el turno tiene **tres** estados —abierto, cerrado y «no lo
   * sabemos»— y un fallo de red que se tradujera a «no tienes turno abierto» haría que el
   * cajero intentara abrir uno que ya está abierto.
   */
  const [ordersResult, shiftResult] = await Promise.allSettled([
    // `open=true`: el servidor filtra las cuentas vivas. Antes se pedía el listado completo y
    // se filtraba aquí, lo que traía todo el histórico del negocio en cada carga.
    serverFetch<Order[]>('/orders?open=true'),
    serverFetch<ShiftSummary | null>('/shifts/current'),
  ]);

  let orders: Order[] | null = null;
  if (ordersResult.status === 'fulfilled') orders = ordersResult.value;
  // Se registra igual, pero ya no decide la pantalla: la vista tira de la copia local.
  else reportApiFailure('pos', ordersResult.reason);

  let shift: ShiftSummary | null = null;
  let shiftUnknown = false;
  if (shiftResult.status === 'fulfilled') shift = shiftResult.value;
  else {
    reportApiFailure('pos:shift', shiftResult.reason);
    shiftUnknown = true;
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Cuentas por cobrar</h1>
      <PosAccountsView
        initialOrders={orders}
        shiftOpen={shift !== null}
        shiftUnknown={shiftUnknown}
      />
    </div>
  );
}
