import Link from 'next/link';
import { SearchXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

/**
 * El estado vacío de «no coincide», que no es el mismo que el de «no hay».
 *
 * Cada tabla del panel tiene su `<Empty>` con un texto tipo «Aún no hay productos en el menú».
 * Con un filtro puesto ese texto **miente**: sí hay productos, lo que no hay es coincidencias, y
 * la diferencia decide qué hace la persona a continuación — crear uno o corregir la búsqueda.
 *
 * Lo elige la página y no la tabla: es una línea por listado, en vez de meter la noción de
 * «filtro activo» en los quince componentes de tabla que hay.
 */
export function NoMatches({ basePath, what = 'resultados' }: { basePath: string; what?: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>Nada que coincida</EmptyTitle>
        <EmptyDescription>
          No hay {what} con esos filtros. Prueba con otra palabra o quítalos.
        </EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={basePath} />}>
        Quitar los filtros
      </Button>
    </Empty>
  );
}
