import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { currentShift } from '@/lib/api/current-shift';
import { PosAccountsView } from '@/components/pos/pos-accounts-view';
import type { Order } from '@loklflow/types';
import { PageHeader } from '@/components/page-header';

export default async function PosPage() {
  /**
   * Las dos peticiones van en paralelo con `allSettled`, no con `all`.
   *
   * `all` rechaza con el primer fallo y perdería el resultado de la otra, y aquí las dos
   * alimentan lógicas distintas: el turno tiene **tres** estados —abierto, cerrado y «no lo
   * sabemos»— y un fallo de red que se tradujera a «no tienes turno abierto» haría que el
   * cajero intentara abrir uno que ya está abierto.
   */
  const [ordersResult, shift] = await Promise.all([
    // `open=true`: el servidor filtra las cuentas vivas. Antes se pedía el listado completo y
    // se filtraba aquí, lo que traía todo el histórico del negocio en cada carga.
    serverFetch<Order[]>('/orders?open=true').catch((err: unknown) => {
      // Se registra igual, pero ya no decide la pantalla: la vista tira de la copia local.
      reportApiFailure('pos', err);
      return null;
    }),
    // El mismo helper que usa el layout, cacheado por petición: una consulta en vez de dos.
    // Ya trae dentro su propio manejo de errores, y por eso este `Promise.all` es seguro —
    // ninguna de las dos promesas puede rechazar y llevarse por delante a la otra.
    currentShift(),
  ]);

  const orders: Order[] | null = ordersResult;
  const shiftUnknown = shift === undefined;

  return (
    <div>
      <PageHeader title="Cuentas por cobrar" />
      <PosAccountsView
        initialOrders={orders}
        shiftOpen={shift != null}
        shiftUnknown={shiftUnknown}
      />
    </div>
  );
}
