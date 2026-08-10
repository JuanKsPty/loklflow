'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Props {
  initial: string;
  ingredients: ReactNode;
  movements: ReactNode;
  suppliers: ReactNode;
}

export function InventoryTabs({ initial, ingredients, movements, suppliers }: Props) {
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
        <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
        <TabsTrigger value="movements">Movimientos</TabsTrigger>
        <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
      </TabsList>

      <TabsContent value="ingredients" className="mt-4">
        {ingredients}
      </TabsContent>
      <TabsContent value="movements" className="mt-4">
        {movements}
      </TabsContent>
      <TabsContent value="suppliers" className="mt-4">
        {suppliers}
      </TabsContent>
    </Tabs>
  );
}
