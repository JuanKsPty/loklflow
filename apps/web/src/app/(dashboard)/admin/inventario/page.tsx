import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { PageHeader } from '@/components/page-header';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { Button } from '@/components/ui/button';
import { InventoryTabs } from '@/components/admin/inventory/inventory-tabs';
import { IngredientTable } from '@/components/admin/inventory/ingredient-table';
import { MovementTable } from '@/components/admin/inventory/movement-table';
import { SupplierTable } from '@/components/admin/inventory/supplier-table';
import { MovementDialog } from '@/components/admin/inventory/movement-dialog';
import { LowStockFilter } from '@/components/admin/inventory/low-stock-filter';
import type { Ingredient, StockMovement, Supplier } from '@loklflow/types';

export const metadata = { title: 'Inventario — LoklFlow' };

const TABS = ['ingredients', 'movements', 'suppliers'] as const;
type Tab = (typeof TABS)[number];

interface Props {
  searchParams: Promise<{ tab?: string; lowStock?: string }>;
}

export default async function InventoryPage({ searchParams }: Props) {
  const { tab, lowStock } = await searchParams;
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'ingredients';
  const onlyLow = lowStock === 'true';

  let ingredients: Ingredient[] = [];
  let movements: StockMovement[] = [];
  let suppliers: Supplier[] = [];
  // Los que están bajo mínimo se piden **al servidor**, que es quien puede comparar dos columnas
  // (`current_stock <= minimum_stock`), en vez de traerse todo y filtrar aquí. Se pide siempre
  // porque el contador del chip tiene que estar aunque no se esté filtrando.
  let low: Ingredient[] = [];
  let failure: 'offline' | 'error' | null = null;
  try {
    [ingredients, movements, suppliers, low] = await Promise.all([
      serverFetch<Ingredient[]>('/inventory/ingredients'),
      serverFetch<StockMovement[]>('/inventory/movements'),
      serverFetch<Supplier[]>('/inventory/suppliers'),
      serverFetch<Ingredient[]>('/inventory/ingredients?lowStock=true'),
    ]);
  } catch (err) {
    failure = reportApiFailure('admin/inventario', err);
  }

  if (failure) {
    return (
      <div>
        <PageHeader title="Inventario" description="Existencias, movimientos y proveedores." />
        <ApiDownNotice what="el inventario" reason={failure} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Existencias, movimientos y proveedores. El stock se descuenta solo al cobrar."
      />

      <InventoryTabs
        initial={active}
        ingredients={
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <LowStockFilter active={onlyLow} lowCount={low.length} />
              <div className="flex justify-end gap-2">
              <MovementDialog ingredients={ingredients} suppliers={suppliers} />
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/inventario/ingredientes/new" />}
              >
                <PlusIcon />
                Nuevo ingrediente
              </Button>
              </div>
            </div>
            <IngredientTable ingredients={onlyLow ? low : ingredients} />
          </>
        }
        movements={<MovementTable movements={movements} />}
        suppliers={
          <>
            <div className="mb-3 flex justify-end">
              <Button
                nativeButton={false}
                render={<Link href="/admin/inventario/proveedores/new" />}
              >
                <PlusIcon />
                Nuevo proveedor
              </Button>
            </div>
            <SupplierTable suppliers={suppliers} />
          </>
        }
      />
    </div>
  );
}
