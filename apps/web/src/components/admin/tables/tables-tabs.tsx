'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Props {
  initial: string;
  map: ReactNode;
  tables: ReactNode;
  sectors: ReactNode;
  reservations: ReactNode;
}

export function TablesTabs({ initial, map, tables, sectors, reservations }: Props) {
  const [value, setValue] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (next: string) => {
    setValue(next);
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  };

  return (
    <Tabs value={value} onValueChange={(v) => handleChange(String(v))}>
      <TabsList>
        <TabsTrigger value="map">Mapa</TabsTrigger>
        <TabsTrigger value="tables">Mesas</TabsTrigger>
        <TabsTrigger value="sectors">Sectores</TabsTrigger>
        <TabsTrigger value="reservations">Reservas</TabsTrigger>
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
    </Tabs>
  );
}
