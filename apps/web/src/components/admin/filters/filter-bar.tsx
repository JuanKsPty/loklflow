import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { UrlParams } from '@/lib/url';

/**
 * La barra de filtros del panel: un formulario GET de verdad, con los controles dentro.
 *
 * Es un `<form method="get">` y no un puñado de `onChange` porque así **funciona sin JavaScript**:
 * el navegador construye la URL solo y el Server Component la lee. Con JavaScript, cada control
 * se adelanta y navega en suave (`router.replace`) sin esperar al envío, que es lo que hace que
 * buscar se sienta inmediato. Los dos caminos acaban en la misma URL, que es lo que se comparte.
 *
 * `hidden` son los parámetros que no tienen control propio en esta barra —la pestaña activa, casi
 * siempre—. Sin ellos, un envío sin JavaScript los perdería: un formulario solo manda sus campos.
 */
export function FilterBar({
  basePath,
  hidden = {},
  children,
  right,
}: {
  basePath: string;
  hidden?: UrlParams;
  children: ReactNode;
  /** Acciones que no son filtros: «Nuevo producto», «Importar CSV». */
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <form
        action={basePath}
        method="get"
        className="flex flex-1 flex-wrap items-center gap-2"
        role="search"
      >
        {Object.entries(hidden).map(([key, value]) =>
          value === undefined || value === null || value === '' || value === false ? null : (
            <input key={key} type="hidden" name={key} value={String(value)} />
          ),
        )}
        {children}
        {/*
          Solo para quien no tiene JavaScript. Con él, los controles ya navegaron por su cuenta y
          este botón sería un segundo camino para lo mismo, en una barra que ya va llena.
        */}
        <noscript>
          <Button type="submit" variant="outline" size="sm">
            Filtrar
          </Button>
        </noscript>
      </form>
      {right ? <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{right}</div> : null}
    </div>
  );
}
