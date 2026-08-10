'use client';

import type { Category, Modifier, Product } from '@loklflow/types';
import { COLLECTIONS } from '@/lib/offline/cache';
import { useCachedCollection } from '@/lib/offline/use-cache';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { PosOrderBuilder } from './pos-order-builder';

/**
 * El catálogo para tomar una comanda, leído del dispositivo.
 *
 * Es la pieza que decide si el mesero puede seguir trabajando durante un corte. Sin el menú
 * guardado, todo lo demás del núcleo offline sirve de poco: se podría cambiar el estado de lo
 * que ya existe, pero no tomar una orden nueva, que es el 90 % del trabajo de un mesero.
 *
 * El catálogo es además lo que menos cambia de todo lo que la aplicación pide, así que
 * guardarlo cuesta casi nada y se queda al día solo en cada visita con red.
 */
export function NewOrderView({
  tableId,
  initialCategories,
  initialProducts,
  initialModifiers,
}: {
  tableId?: string;
  initialCategories: Category[] | null;
  initialProducts: Product[] | null;
  initialModifiers: Modifier[] | null;
}) {
  const categories = useCachedCollection<Category>(COLLECTIONS.categories, initialCategories);
  const products = useCachedCollection<Product>(COLLECTIONS.products, initialProducts);
  const modifiers = useCachedCollection<Modifier>(COLLECTIONS.modifiers, initialModifiers);

  // Sin servidor **y** sin catálogo guardado no hay nada que ofrecer. Es el único caso en que
  // esta pantalla no puede hacer su trabajo, y entonces sí hay que decirlo.
  if (products.length === 0) {
    return <ApiDownNotice what="el menú" reason={initialProducts === null ? 'offline' : 'error'} />;
  }

  return (
    <PosOrderBuilder
      tableId={tableId}
      categories={categories.filter((c) => c.isActive)}
      products={products.filter((p) => p.isActive)}
      modifiers={modifiers}
    />
  );
}
