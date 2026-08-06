'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportBrowserError } from '@/lib/observability/report';

/**
 * El error boundary que faltaba en toda la aplicación.
 *
 * Sin este archivo, un throw en cualquier página renderiza el `DefaultGlobalError` interno de
 * Next, que **emite su propio `<html>` y reemplaza el RootLayout entero**: se pierden las
 * fuentes, el tema, el `Toaster` y toda la cáscara, y el operario ve una pantalla en inglés
 * que no se parece en nada al sistema con el que estaba trabajando.
 *
 * Con él, el fallo queda contenido: el layout sigue en pie y hay un botón para reintentar sin
 * recargar, que en una tablet a media comanda no es un detalle menor.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En un fallo del servidor Next ya lo reportó por `onRequestError`; este es el único
    // camino para los que ocurren renderizando en el navegador.
    reportBrowserError('error-boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlertIcon className="size-10 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Algo se rompió en esta pantalla</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          El resto del sistema sigue funcionando. Puedes reintentar aquí mismo; si vuelve a
          fallar, vuelve al inicio y avisa.
        </p>
      </div>

      {/* En producción Next oculta el mensaje real y deja solo este identificador. Es lo
          único que permite encontrar la traza en el servidor, así que se muestra. */}
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Referencia: <span className="select-all">{error.digest}</span>
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcwIcon />
          Reintentar
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Ir al inicio
        </Button>
      </div>
    </div>
  );
}
