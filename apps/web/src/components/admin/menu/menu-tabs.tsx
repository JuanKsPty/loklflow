'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
    // mantiene la pestaña en la URL para deep-links y al volver de un formulario
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
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
