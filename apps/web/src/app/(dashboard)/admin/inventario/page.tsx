import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { buildHref, hasAnyFilter } from '@/lib/url';
import { PageHeader } from '@/components/page-header';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { Button } from '@/components/ui/button';
import { InventoryTabs } from '@/components/admin/inventory/inventory-tabs';
import { IngredientTable } from '@/components/admin/inventory/ingredient-table';
import { MovementTable } from '@/components/admin/inventory/movement-table';
import { SupplierTable } from '@/components/admin/inventory/supplier-table';
import { MovementDialog } from '@/components/admin/inventory/movement-dialog';
import { ProductStockTable } from '@/components/admin/inventory/product-stock-table';
import { FilterBar } from '@/components/admin/filters/filter-bar';
import { FilterChips } from '@/components/admin/filters/filter-chips';
import { NoMatches } from '@/components/admin/filters/no-matches';
import { ResultCount } from '@/components/admin/filters/result-count';
import { SearchField } from '@/components/admin/filters/search-field';
import { SelectFilter } from '@/components/admin/filters/select-filter';
import type { Category, Ingredient, ProductStock, StockMovement, Supplier } from '@loklflow/types';

export const metadata = { title: 'Inventario — LoklFlow' };

const BASE_PATH = '/admin/inventario';
const TABS = ['products', 'ingredients', 'movements', 'suppliers'] as const;
type Tab = (typeof TABS)[number];

/**
 * El tope del servidor para el libro mayor, dicho aquí en vez de sufrido en silencio.
 *
 * `stock.service.ts` ya recortaba a los 100 más recientes cuando nadie mandaba `take`, y la
 * pantalla no lo decía: la tabla se leía como «esto es todo lo que ha pasado». Se pide explícito
 * para poder avisar cuando el historial está recortado.
 */
const MOVIMIENTOS_TAKE = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    categoria?: string;
    lowStock?: string;
    ingredientId?: string;
  }>;
}

export default async function InventoryPage({ searchParams }: Props) {
  const sp = await searchParams;
  // Por defecto, las existencias por producto: es la pantalla del día a día.
  const active: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'products';
  const onlyLow = sp.lowStock === 'true';
  // Lista blanca antes de reenviar nada: lo que llega por la URL lo escribe cualquiera, y el
  // `ValidationPipe` de la API convierte un uuid mal formado en un 400 que tumbaría la pantalla.
  const q = sp.q?.trim() || undefined;
  const categoria = sp.categoria?.trim() || undefined;
  const ingredientId = UUID.test(sp.ingredientId ?? '') ? sp.ingredientId : undefined;

  // Cada pestaña solo manda lo que entiende. `?categoria=` no significa nada en Proveedores.
  const filtros =
    active === 'products'
      ? { q, categoria }
      : active === 'movements'
        ? { ingredientId }
        : { q };
  const hayFiltros = hasAnyFilter(filtros);
  const params = { tab: active, ...filtros, lowStock: onlyLow ? 'true' : undefined };

  const consulta = (extra: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) if (v) query.set(k, v);
    const qs = query.toString();
    return qs ? `?${qs}` : '';
  };

  // El texto solo viaja en la pestaña a la que pertenece: en Movimientos, `products` e
  // `ingredients` alimentan el desplegable y recortarlos dejaría fuera justo lo que se busca.
  const qDe = (tab: Tab) => (active === tab ? q : undefined);

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
      // La lista entera de la pestaña, ya filtrada por el servidor. El chip de bajo mínimo sigue
      // aplicándose aquí porque la fila **ya trae calculado** `lowStock` —la comparación la hizo
      // el servidor—, así que pedirla dos veces solo serviría para contar el chip, y además el
      // contador tiene que hablar de lo que se está viendo: «3 bajo mínimo» de otra búsqueda
      // distinta a la que hay en pantalla no significaría nada.
      serverFetch<ProductStock[]>(
        `/inventory/products${consulta({ q: qDe('products'), category: categoria })}`,
      ),
      serverFetch<Ingredient[]>(`/inventory/ingredients${consulta({ q: qDe('ingredients') })}`),
      serverFetch<StockMovement[]>(
        `/inventory/movements${consulta({ ingredientId, take: String(MOVIMIENTOS_TAKE) })}`,
      ),
      serverFetch<Supplier[]>(`/inventory/suppliers${consulta({ q: qDe('suppliers') })}`),
      serverFetch<Ingredient[]>(
        `/inventory/ingredients${consulta({ lowStock: 'true', q: qDe('ingredients') })}`,
      ),
    ]);
  } catch (err) {
    failure = reportApiFailure('admin/inventario', err);
  }

  /**
   * Las categorías del desplegable salen del catálogo del menú y no de las filas ya traídas: con
   * una búsqueda puesta, las filas solo contienen las categorías que sobrevivieron al filtro y el
   * desplegable se iría encogiendo a cada tecla.
   *
   * En su propio `try` porque es la única petición de esta pantalla que pide `menu:read`: un rol
   * de almacén que no lo tenga se queda sin desplegable, no sin pantalla.
   */
  let categories: Category[] = [];
  try {
    categories = await serverFetch<Category[]>('/menu/categories');
  } catch {
    // sin desplegable de categorías; el resto del inventario sigue funcionando
  }

  const lowProducts = products.filter((p) => p.lowStock);
  const visibleProducts = onlyLow ? lowProducts : products;
  const visibleIngredients = onlyLow ? low : ingredients;

  if (failure) {
    return (
      <div>
        <PageHeader title="Inventario" description="Existencias, movimientos y proveedores." />
        <ApiDownNotice what="el inventario" reason={failure} />
      </div>
    );
  }

  const vacioPorFiltro = (n: number) => (hayFiltros || onlyLow) && n === 0;
  const sinFiltros = (tab: Tab) => buildHref(BASE_PATH, { tab });

  /** Los movimientos apuntan a un ingrediente; los productos vendibles, a su espejo. */
  const opcionesMovimiento = [
    {
      label: 'Productos',
      options: products
        .filter((p) => p.tracked && p.ingredientId)
        // `p.name` y no el del ingrediente: el del espejo es una copia hecha al empezar a llevar
        // existencias y puede haberse quedado con el nombre viejo del producto.
        .map((p) => ({ value: p.ingredientId as string, label: p.name })),
    },
    {
      label: 'Insumos',
      options: ingredients.map((i) => ({ value: i.id, label: i.name })),
    },
  ];

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
            <FilterBar basePath={BASE_PATH} hidden={{ tab: 'products', lowStock: sp.lowStock }}>
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar un producto"
                label="Buscar un producto por su nombre"
              />
              {categories.length > 0 && (
                <SelectFilter
                  basePath={BASE_PATH}
                  params={params}
                  name="categoria"
                  label="Filtrar por categoría"
                  value={categoria}
                  allLabel="Todas las categorías"
                  options={categories.map((c) => ({ value: c.name, label: c.name }))}
                />
              )}
              <FilterChips
                basePath={BASE_PATH}
                params={params}
                name="lowStock"
                label="Filtrar por existencias"
                options={[
                  { label: 'Todos' },
                  { value: 'true', label: 'Bajo mínimo', badge: lowProducts.length },
                ]}
              />
            </FilterBar>
            {vacioPorFiltro(visibleProducts.length) ? (
              <NoMatches basePath={sinFiltros('products')} what="productos" />
            ) : (
              <>
                <ProductStockTable products={visibleProducts} />
                <ResultCount
                  shown={visibleProducts.length}
                  total={products.length}
                  one="producto"
                  many="productos"
                />
              </>
            )}
          </>
        }
        ingredients={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'ingredients', lowStock: sp.lowStock }}
              right={
                <>
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
                </>
              }
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar un insumo"
                label="Buscar un insumo por su nombre"
              />
              <FilterChips
                basePath={BASE_PATH}
                params={params}
                name="lowStock"
                label="Filtrar por existencias"
                options={[
                  { label: 'Todos' },
                  { value: 'true', label: 'Bajo mínimo', badge: low.length },
                ]}
              />
            </FilterBar>
            {vacioPorFiltro(visibleIngredients.length) ? (
              <NoMatches basePath={sinFiltros('ingredients')} what="insumos" />
            ) : (
              <IngredientTable ingredients={visibleIngredients} />
            )}
          </>
        }
        movements={
          <>
            <FilterBar basePath={BASE_PATH} hidden={{ tab: 'movements' }}>
              {/*
                Antes, la única forma de ver el historial de un producto era pegar su uuid en la
                barra de direcciones. El uuid sigue viajando por debajo; lo que cambia es que se
                elige por su nombre.
              */}
              <SelectFilter
                basePath={BASE_PATH}
                params={params}
                name="ingredientId"
                label="Filtrar los movimientos por producto o insumo"
                value={ingredientId}
                allLabel="Todo el movimiento"
                groups={opcionesMovimiento}
                className="w-full sm:w-72"
              />
            </FilterBar>
            {vacioPorFiltro(movements.length) ? (
              <NoMatches basePath={sinFiltros('movements')} what="movimientos" />
            ) : (
              <>
                <MovementTable movements={movements} />
                <ResultCount
                  shown={movements.length}
                  one="movimiento"
                  many="movimientos"
                  capped={movements.length >= MOVIMIENTOS_TAKE}
                />
              </>
            )}
          </>
        }
        suppliers={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'suppliers' }}
              right={
                <Button
                  className="w-full sm:w-auto"
                  nativeButton={false}
                  render={<Link href="/admin/inventario/proveedores/new" />}
                >
                  <PlusIcon />
                  Nuevo proveedor
                </Button>
              }
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar un proveedor"
                label="Buscar un proveedor por su nombre"
              />
            </FilterBar>
            {vacioPorFiltro(suppliers.length) ? (
              <NoMatches basePath={sinFiltros('suppliers')} what="proveedores" />
            ) : (
              <SupplierTable suppliers={suppliers} />
            )}
          </>
        }
      />
    </div>
  );
}
