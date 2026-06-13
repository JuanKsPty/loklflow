import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { serverFetch } from '@/lib/api/server-client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { MenuTabs } from '@/components/admin/menu/menu-tabs';
import { ProductTable } from '@/components/admin/menu/product-table';
import { CategoryTable } from '@/components/admin/menu/category-table';
import { ModifierTable } from '@/components/admin/menu/modifier-table';
import { ComboTable } from '@/components/admin/menu/combo-table';
import type { Category, Combo, Modifier, Product } from '@loklflow/types';

export const metadata = { title: 'Menú — LoklFlow' };

const TABS = ['products', 'categories', 'modifiers', 'combos'] as const;
type Tab = (typeof TABS)[number];

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

function TabAction({ href, label }: { href: string; label: string }) {
  return (
    <div className="mb-3 flex justify-end">
      <Button nativeButton={false} render={<Link href={href} />}>
        <PlusIcon />
        {label}
      </Button>
    </div>
  );
}

export default async function MenuPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'products';

  let products: Product[] = [];
  let categories: Category[] = [];
  let modifiers: Modifier[] = [];
  let combos: Combo[] = [];
  try {
    [products, categories, modifiers, combos] = await Promise.all([
      serverFetch<Product[]>('/menu/products'),
      serverFetch<Category[]>('/menu/categories'),
      serverFetch<Modifier[]>('/menu/modifiers'),
      serverFetch<Combo[]>('/menu/combos'),
    ]);
  } catch {
    // muestra tablas vacías si la API no está disponible
  }

  return (
    <div>
      <PageHeader title="Menú" description="Productos, categorías, modificadores y combos." />

      <MenuTabs
        initial={active}
        products={
          <>
            <TabAction href="/admin/menu/products/new" label="Nuevo producto" />
            <ProductTable products={products} />
          </>
        }
        categories={
          <>
            <TabAction href="/admin/menu/categories/new" label="Nueva categoría" />
            <CategoryTable categories={categories} />
          </>
        }
        modifiers={
          <>
            <TabAction href="/admin/menu/modifiers/new" label="Nuevo modificador" />
            <ModifierTable modifiers={modifiers} />
          </>
        }
        combos={
          <>
            <TabAction href="/admin/menu/combos/new" label="Nuevo combo" />
            <ComboTable combos={combos} />
          </>
        }
      />
    </div>
  );
}
