import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { PageHeader } from '@/components/page-header';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { ImportProducts } from '@/components/admin/menu/import/import-products';
import type { Category, Product } from '@loklflow/types';

export const metadata = { title: 'Importar productos — LoklFlow' };

/**
 * Una ruta y no un diálogo.
 *
 * Un `Dialog` en 390 px con una lista de doscientas filas pelea con el desplazamiento de la página,
 * y un toque en el fondo tira el parseo entero. Con una ruta, el botón «atrás» del teléfono se
 * comporta y el estado sobrevive a un re-render.
 *
 * El catálogo actual se carga aquí para que la previsualización pueda decir qué se crea y qué se
 * actualiza **antes** de mandar nada.
 */
export default async function ImportProductsPage() {
  let products: Product[] = [];
  let categories: Category[] = [];
  let failure: 'offline' | 'error' | null = null;
  try {
    [products, categories] = await Promise.all([
      serverFetch<Product[]>('/menu/products'),
      serverFetch<Category[]>('/menu/categories'),
    ]);
  } catch (err) {
    failure = reportApiFailure('admin/menu/import', err);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Importar productos"
        description="Sube un CSV y revisa qué va a pasar antes de guardar nada."
      />
      {failure ? (
        <ApiDownNotice what="el catálogo" reason={failure} />
      ) : (
        <ImportProducts products={products} categories={categories} />
      )}
    </div>
  );
}
