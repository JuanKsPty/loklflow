'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { buildHref } from '@/lib/url';

interface Props {
  initial: string;
  products: ReactNode;
  ingredients: ReactNode;
  movements: ReactNode;
  suppliers: ReactNode;
}

export function InventoryTabs({ initial, products, ingredients, movements, suppliers }: Props) {
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
      {/*
        «Productos» va primero y es la pestaña por defecto: es lo que abre a diario quien lleva el
        negocio. Ingredientes, movimientos y proveedores siguen ahí, detrás — no se quita nada,
        solo cambia qué se ve al entrar.
      */}
      <TabsList>
        <TabsTrigger value="products">Productos</TabsTrigger>
        <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
        <TabsTrigger value="movements">Movimientos</TabsTrigger>
        <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
      </TabsList>

      <TabsContent value="products" className="mt-4">
        {products}
      </TabsContent>
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
