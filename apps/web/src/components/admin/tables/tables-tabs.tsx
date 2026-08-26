'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { buildHref } from '@/lib/url';

interface Props {
  initial: string;
  map: ReactNode;
  tables: ReactNode;
  sectors: ReactNode;
  reservations: ReactNode;
  qr: ReactNode;
}

export function TablesTabs({ initial, map, tables, sectors, reservations, qr }: Props) {
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
        <TabsTrigger value="map">Mapa</TabsTrigger>
        <TabsTrigger value="tables">Mesas</TabsTrigger>
        <TabsTrigger value="sectors">Sectores</TabsTrigger>
        <TabsTrigger value="reservations">Reservas</TabsTrigger>
        <TabsTrigger value="qr">Códigos QR</TabsTrigger>
      </TabsList>

      <TabsContent value="map" className="mt-4">
        {map}
      </TabsContent>
      <TabsContent value="tables" className="mt-4">
        {tables}
      </TabsContent>
      <TabsContent value="sectors" className="mt-4">
        {sectors}
      </TabsContent>
      <TabsContent value="reservations" className="mt-4">
        {reservations}
      </TabsContent>
      <TabsContent value="qr" className="mt-4">
        {qr}
      </TabsContent>
    </Tabs>
  );
}
