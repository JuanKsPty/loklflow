import { notFound } from 'next/navigation';
import { isNotFound, serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { PageHeader } from '@/components/page-header';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { IngredientForm } from '@/components/admin/inventory/ingredient-form';
import { MovementTable } from '@/components/admin/inventory/movement-table';
import type { Ingredient, StockMovement } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditIngredientPage({ params }: Props) {
  const { id } = await params;

  let ingredient: Ingredient | null = null;
  let movements: StockMovement[] = [];
  let failure: 'offline' | 'error' | null = null;
  try {
    [ingredient, movements] = await Promise.all([
      serverFetch<Ingredient>(`/inventory/ingredients/${id}`),
      serverFetch<StockMovement[]>(`/inventory/movements?ingredientId=${id}`),
    ]);
  } catch (err) {
    // Solo un 404 significa que el ingrediente no existe; lo demás es que no pudimos preguntar.
    if (isNotFound(err)) notFound();
    failure = reportApiFailure('admin/inventario/ingrediente', err);
  }

  if (!ingredient) {
    return (
      <div>
        <PageHeader title="Ingrediente" />
        <ApiDownNotice what="el ingrediente" reason={failure ?? 'error'} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Editar ingrediente" description={ingredient.name} />
      <IngredientForm ingredient={ingredient} />
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Historial</h2>
        <MovementTable movements={movements} />
      </div>
    </div>
  );
}
