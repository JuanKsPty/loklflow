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
import { ProductStockTable } from '@/components/admin/inventory/product-stock-table';
import type { Ingredient, ProductStock, StockMovement, Supplier } from '@loklflow/types';

export const metadata = { title: 'Inventario — LoklFlow' };

const TABS = ['products', 'ingredients', 'movements', 'suppliers'] as const;
type Tab = (typeof TABS)[number];

interface Props {
  searchParams: Promise<{ tab?: string; lowStock?: string }>;
}

export default async function InventoryPage({ searchParams }: Props) {
  const { tab, lowStock } = await searchParams;
  // Por defecto, las existencias por producto: es la pantalla del día a día.
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'products';
  const onlyLow = lowStock === 'true';

  let products: ProductStock[] = [];
  let ingredients: Ingredient[] = [];
  let movements: StockMovement[] = [];
  let suppliers: Supplier[] = [];
  // Los que están bajo mínimo se piden **al servidor**, que es quien puede comparar dos columnas
  // (`current_stock <= minimum_stock`), en vez de traerse todo y filtrar aquí. Se pide siempre
  // porque el contador del chip tiene que estar aunque no se esté filtrando.
  let low: Ingredient[] = [];
  let failure: 'offline' | 'error' | null = null;
  try {
    [products, ingredients, movements, suppliers, low] = await Promise.all([
      // Aquí sí se trae la lista entera y el filtro se aplica abajo, al revés que con los insumos.
      // El motivo es que la fila **ya trae calculado** `lowStock` —la comparación la hizo el
      // servidor—, así que pedirla dos veces solo serviría para contar el chip. Una carta son
      // decenas de productos, no un histórico.
      serverFetch<ProductStock[]>('/inventory/products'),
      serverFetch<Ingredient[]>('/inventory/ingredients'),
      serverFetch<StockMovement[]>('/inventory/movements'),
      serverFetch<Supplier[]>('/inventory/suppliers'),
      serverFetch<Ingredient[]>('/inventory/ingredients?lowStock=true'),
    ]);
  } catch (err) {
    failure = reportApiFailure('admin/inventario', err);
  }

  const lowProducts = products.filter((p) => p.lowStock);

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
        description="Lo que hay de cada producto. El stock baja solo al cobrar."
      />

      <InventoryTabs
        initial={active}
        products={
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <LowStockFilter active={onlyLow} lowCount={lowProducts.length} tab="products" />
            </div>
            <ProductStockTable products={onlyLow ? lowProducts : products} />
          </>
        }
        ingredients={
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <LowStockFilter active={onlyLow} lowCount={low.length} />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <MovementDialog ingredients={ingredients} suppliers={suppliers} />
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
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
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
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
