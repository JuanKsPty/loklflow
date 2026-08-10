'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * Dos chips para alternar entre todos los ingredientes y solo los que están bajo mínimo.
 *
 * El filtro existía en el servidor desde que se entregó el inventario (`?lowStock=true`) y
 * `inventoryApi.ingredients.lowStock()` estaba escrito, pero **nadie llamaba a ninguno de los dos**:
 * la única forma de saber qué hay que reponer era leer la tabla entera buscando insignias rojas.
 *
 * Enlaces y no estado de cliente: así la vista de compras es una URL que se puede guardar, mandar
 * por mensaje y abrir cada mañana, y el filtrado lo sigue haciendo el servidor —que es quien puede
 * comparar dos columnas— en vez de traerse todo para descartar en el navegador.
 */
export function LowStockFilter({ active, lowCount }: { active: boolean; lowCount: number }) {
  return (
    <div className="flex gap-2">
      <Chip href="/admin/inventario?tab=ingredients" active={!active}>
        Todos
      </Chip>
      <Chip href="/admin/inventario?tab=ingredients&lowStock=true" active={active}>
        Bajo mínimo
        {lowCount > 0 && (
          <Badge variant={active ? 'secondary' : 'destructive'} className="ml-1.5">
            {lowCount}
          </Badge>
        )}
      </Chip>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </Link>
  );
}
