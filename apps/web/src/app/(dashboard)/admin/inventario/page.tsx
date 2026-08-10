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
import type { Ingredient, StockMovement, Supplier } from '@loklflow/types';

export const metadata = { title: 'Inventario — LoklFlow' };

const TABS = ['ingredients', 'movements', 'suppliers'] as const;
type Tab = (typeof TABS)[number];

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function InventoryPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'ingredients';

  let ingredients: Ingredient[] = [];
  let movements: StockMovement[] = [];
  let suppliers: Supplier[] = [];
  let failure: 'offline' | 'error' | null = null;
  try {
    [ingredients, movements, suppliers] = await Promise.all([
      serverFetch<Ingredient[]>('/inventory/ingredients'),
      serverFetch<StockMovement[]>('/inventory/movements'),
      serverFetch<Supplier[]>('/inventory/suppliers'),
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
            <div className="mb-3 flex justify-end gap-2">
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
            <IngredientTable ingredients={ingredients} />
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
