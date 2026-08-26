'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { buildHref } from '@/lib/url';

interface Props {
  initial: string;
  products: ReactNode;
  categories: ReactNode;
  modifiers: ReactNode;
  combos: ReactNode;
}

export function MenuTabs({ initial, products, categories, modifiers, combos }: Props) {
  const [value, setValue] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (next: string) => {
    setValue(next);
    /**
     * Se conserva la pestaña —para deep-links y para volver de un formulario— y **se limpian los
     * filtros**, que es deliberado y no un descuido.
     *
     * Un filtro no significa lo mismo en dos pestañas: `?categoria=Bebidas` no quiere decir nada
     * en Proveedores, y arrastrarlo dejaría la tabla vacía sin que nada explicara por qué. Una
     * regla, la misma en las tres pantallas de pestañas, y se cuenta en una frase.
     *
     * Antes esto era `?tab=${next}` a pelo, que ya borraba `?lowStock=true` sin quererlo.
     */
    router.replace(buildHref(pathname, { tab: next }), { scroll: false });
  };

  return (
    <Tabs value={value} onValueChange={(v) => handleChange(String(v))}>
      <TabsList>
        <TabsTrigger value="products">Productos</TabsTrigger>
        <TabsTrigger value="categories">Categorías</TabsTrigger>
        <TabsTrigger value="modifiers">Modificadores</TabsTrigger>
        <TabsTrigger value="combos">Combos</TabsTrigger>
      </TabsList>

      <TabsContent value="products" className="mt-4">
        {products}
      </TabsContent>
      <TabsContent value="categories" className="mt-4">
        {categories}
      </TabsContent>
      <TabsContent value="modifiers" className="mt-4">
        {modifiers}
      </TabsContent>
      <TabsContent value="combos" className="mt-4">
        {combos}
      </TabsContent>
    </Tabs>
  );
}
