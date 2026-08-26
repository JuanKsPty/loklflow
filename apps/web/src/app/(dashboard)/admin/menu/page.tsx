import Link from 'next/link';
import { PlusIcon, UploadIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { buildHref, hasAnyFilter } from '@/lib/url';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { MenuTabs } from '@/components/admin/menu/menu-tabs';
import { ProductTable } from '@/components/admin/menu/product-table';
import { CategoryTable } from '@/components/admin/menu/category-table';
import { ModifierTable } from '@/components/admin/menu/modifier-table';
import { ComboTable } from '@/components/admin/menu/combo-table';
import { FilterBar } from '@/components/admin/filters/filter-bar';
import { FilterChips } from '@/components/admin/filters/filter-chips';
import { NoMatches } from '@/components/admin/filters/no-matches';
import { SearchField } from '@/components/admin/filters/search-field';
import { SelectFilter } from '@/components/admin/filters/select-filter';
import type { Category, Combo, Modifier, Product } from '@loklflow/types';

export const metadata = { title: 'Menú — LoklFlow' };

const BASE_PATH = '/admin/menu';
const TABS = ['products', 'categories', 'modifiers', 'combos'] as const;
type Tab = (typeof TABS)[number];
const ESTADOS = ['activos', 'inactivos'] as const;

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; categoria?: string; estado?: string }>;
}

function TabAction({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  /** Acciones secundarias, a la izquierda de la primaria. */
  children?: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Button className="w-full sm:w-auto" nativeButton={false} render={<Link href={href} />}>
        <PlusIcon />
        {label}
      </Button>
    </>
  );
}

export default async function MenuPage({ searchParams }: Props) {
  const sp = await searchParams;
  const active: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'products';
  // Lista blanca antes de reenviar nada a la API, igual que en Auditoría: lo que llega por la URL
  // lo escribe cualquiera, y `forbidNonWhitelisted` convierte un parámetro raro en un 400.
  const q = sp.q?.trim() || undefined;
  const categoria = sp.categoria?.trim() || undefined;
  const estado = ESTADOS.includes(sp.estado as (typeof ESTADOS)[number]) ? sp.estado : undefined;

  // Los filtros que la pestaña activa entiende. Los demás no se mandan aunque estén en la URL.
  const deProductos = { q, categoria, estado };
  const filtros = active === 'products' ? deProductos : { q };
  const hayFiltros = hasAnyFilter(filtros);
  // Lo que se conserva al navegar dentro de la misma pestaña.
  const params = { tab: active, ...filtros };

  const consulta = (extra: Record<string, string | undefined> = {}) => {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    for (const [k, v] of Object.entries(extra)) if (v) query.set(k, v);
    const qs = query.toString();
    return qs ? `?${qs}` : '';
  };

  let products: Product[] = [];
  let categories: Category[] = [];
  let modifiers: Modifier[] = [];
  let combos: Combo[] = [];
  try {
    [products, categories, modifiers, combos] = await Promise.all([
      serverFetch<Product[]>(
        `/menu/products${consulta({
          category: categoria,
          active: estado ? String(estado === 'activos') : undefined,
        })}`,
      ),
      // Las categorías se piden **sin filtrar por `q`** cuando no es su pestaña: alimentan el
      // desplegable de Productos, y recortarlas dejaría fuera la que se está buscando.
      serverFetch<Category[]>(`/menu/categories${active === 'categories' ? consulta() : ''}`),
      serverFetch<Modifier[]>(`/menu/modifiers${active === 'modifiers' ? consulta() : ''}`),
      serverFetch<Combo[]>(`/menu/combos${active === 'combos' ? consulta() : ''}`),
    ]);
  } catch {
    // muestra tablas vacías si la API no está disponible
  }

  const vacioPorFiltro = (n: number) => hayFiltros && n === 0;

  return (
    <div>
      <PageHeader title="Menú" description="Productos, categorías, modificadores y combos." />

      <MenuTabs
        initial={active}
        products={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'products', estado }}
              right={
                <TabAction href="/admin/menu/products/new" label="Nuevo producto">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    nativeButton={false}
                    render={<Link href="/admin/menu/import" />}
                  >
                    <UploadIcon />
                    Importar CSV
                  </Button>
                </TabAction>
              }
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar un producto"
                label="Buscar un producto por su nombre"
              />
              <SelectFilter
                basePath={BASE_PATH}
                params={params}
                name="categoria"
                label="Filtrar por categoría"
                value={categoria}
                allLabel="Todas las categorías"
                options={categories.map((c) => ({ value: c.name, label: c.name }))}
              />
              <FilterChips
                basePath={BASE_PATH}
                params={params}
                name="estado"
                label="Filtrar por estado"
                options={[
                  { label: 'Todos' },
                  { value: 'activos', label: 'Activos' },
                  { value: 'inactivos', label: 'Inactivos' },
                ]}
              />
            </FilterBar>
            {vacioPorFiltro(products.length) ? (
              <NoMatches basePath={buildHref(BASE_PATH, { tab: 'products' })} what="productos" />
            ) : (
              <ProductTable products={products} />
            )}
          </>
        }
        categories={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'categories' }}
              right={<TabAction href="/admin/menu/categories/new" label="Nueva categoría" />}
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar una categoría"
                label="Buscar una categoría por su nombre"
              />
            </FilterBar>
            {vacioPorFiltro(categories.length) ? (
              <NoMatches basePath={buildHref(BASE_PATH, { tab: 'categories' })} what="categorías" />
            ) : (
              <CategoryTable categories={categories} />
            )}
          </>
        }
        modifiers={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'modifiers' }}
              right={<TabAction href="/admin/menu/modifiers/new" label="Nuevo modificador" />}
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar un modificador"
                label="Buscar un modificador por su nombre"
              />
            </FilterBar>
            {vacioPorFiltro(modifiers.length) ? (
              <NoMatches
                basePath={buildHref(BASE_PATH, { tab: 'modifiers' })}
                what="modificadores"
              />
            ) : (
              <ModifierTable modifiers={modifiers} />
            )}
          </>
        }
        combos={
          <>
            <FilterBar
              basePath={BASE_PATH}
              hidden={{ tab: 'combos' }}
              right={<TabAction href="/admin/menu/combos/new" label="Nuevo combo" />}
            >
              <SearchField
                basePath={BASE_PATH}
                params={params}
                defaultValue={q ?? ''}
                placeholder="Buscar un combo"
                label="Buscar un combo por su nombre"
              />
            </FilterBar>
            {vacioPorFiltro(combos.length) ? (
              <NoMatches basePath={buildHref(BASE_PATH, { tab: 'combos' })} what="combos" />
            ) : (
              <ComboTable combos={combos} />
            )}
          </>
        }
      />
    </div>
  );
}
