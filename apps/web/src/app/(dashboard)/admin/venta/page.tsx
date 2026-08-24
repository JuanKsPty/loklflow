import { serverFetch } from '@/lib/api/server-client';
import { currentShift } from '@/lib/api/current-shift';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { PageHeader } from '@/components/page-header';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { QuickSaleView } from '@/components/admin/quick-sale/quick-sale-view';
import { OpenShiftNotice } from '@/components/admin/quick-sale/open-shift-notice';
import type { ProductStock } from '@loklflow/types';

export const metadata = { title: 'Venta rápida — LoklFlow' };

/**
 * Venta de mostrador: despachar y cobrar en el mismo gesto, sin mesa ni comanda.
 *
 * El catálogo llega con sus existencias en **una sola petición** (`/inventory/products` trae
 * nombre, precio, categoría y stock), que es lo que permite pintar la rejilla y el aviso de
 * agotado sin encadenar consultas.
 */
export default async function QuickSalePage() {
  let products: ProductStock[] = [];
  let failure: 'offline' | 'error' | null = null;
  try {
    products = await serverFetch<ProductStock[]>('/inventory/products');
  } catch (err) {
    failure = reportApiFailure('admin/venta', err);
  }

  // `undefined` es «no se pudo consultar» y `null` es «no hay turno»: confundirlos pintaría
  // «abre tu turno» sobre uno ya abierto, y abrirlo entonces choca contra el índice único.
  const shift = await currentShift();
  const sinTurno = shift === null;

  if (failure) {
    return (
      <div>
        <PageHeader title="Venta rápida" description="Cobra en el mostrador." />
        <ApiDownNotice what="el catálogo" reason={failure} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Venta rápida"
        description="Elige, cobra y listo. La venta descuenta existencias y entra en el arqueo."
      />

      {sinTurno && <OpenShiftNotice />}

      <QuickSaleView products={products} canCharge={!sinTurno} />
    </div>
  );
}
