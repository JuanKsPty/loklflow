import { Skeleton } from '@/components/ui/skeleton';

/**
 * Esqueletos de carga, en un solo sitio.
 *
 * `design-system.md` §7 los prescribe y `Skeleton` llevaba instalado desde la primera fase con
 * un único consumidor: la barra lateral. Estos los usan los `loading.tsx` de las rutas que
 * **hacen varias peticiones al servidor antes de pintar nada** — entre dos y seis—, que son las
 * que de verdad tardan.
 *
 * **No hay uno para las 26 pantallas de alta y edición.** Un esqueleto para cuarenta
 * milisegundos es un parpadeo: se ve peor que no poner nada, y añade un archivo por ruta que
 * mantener. La regla es «más de una petición», no «toda página».
 */

/** Rejilla de tarjetas: el salón, el inventario, el panel. */
export function GridSkeleton({ items = 6, className }: { items?: number; className?: string }) {
  return (
    <div className={className ?? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'}>
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

/** Lista de filas: comandas, movimientos, bitácora. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

/** Encabezado de página: mismo alto que `PageHeader`, para que no salte al llegar el contenido. */
export function HeaderSkeleton() {
  return <Skeleton className="mb-6 h-7 w-48 rounded-lg" />;
}

/** Panel de detalle en dos columnas: la cuenta del mesero, el cobro. */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40 rounded-lg" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

/** El panel del dueño: cuatro indicadores y dos gráficas. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
