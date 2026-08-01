'use client';

import { useEffect } from 'react';
import { reportBrowserError } from '@/lib/observability/report';

/**
 * La última red: un fallo en el propio RootLayout, donde ya no hay layout que preservar.
 *
 * Por eso emite su `<html>` y su `<body>`, y por eso los estilos van **en línea** en lugar de
 * usar Tailwind: una causa perfectamente posible de llegar aquí es que la hoja de estilos no
 * haya cargado, y una pantalla de error que depende de la hoja que falló no sirve de nada.
 *
 * El tema se resuelve con `prefers-color-scheme` y no con la clase `.dark`: `ThemeProvider`
 * no está montado en este punto, así que nadie la pone. Se acierta con la preferencia del
 * sistema —que es el valor por defecto de la aplicación— y en el peor caso, alguien que forzó
 * el tema oscuro contra un sistema claro, se ve claro. Es un compromiso consciente y muy
 * preferible al blanco fijo del error por defecto de Next, que a media noche ciega.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportBrowserError('global-error', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="es">
      <body>
        <style>{CSS}</style>
        <main>
          <h1>El sistema no pudo cargar</h1>
          <p>
            Falló algo básico de la aplicación, no solo esta pantalla. Reintenta; si sigue
            igual, cierra y vuelve a abrir.
          </p>
          {error.digest && (
            <p className="ref">
              Referencia: <span>{error.digest}</span>
            </p>
          )}
          <button type="button" onClick={reset}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}

const CSS = `
  :root { color-scheme: light dark; --bg: #ffffff; --fg: #0a0a0a; --muted: #6b7280; --line: #e5e7eb; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0a0a0a; --fg: #fafafa; --muted: #a1a1aa; --line: #27272a; }
  }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--bg); color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 32rem; padding: 2rem; text-align: center; }
  h1 { margin: 0 0 .75rem; font-size: 1.25rem; }
  p { margin: 0 0 1rem; color: var(--muted); font-size: .875rem; line-height: 1.5; }
  .ref { font-family: ui-monospace, monospace; font-size: .75rem; }
  .ref span { user-select: all; }
  button {
    padding: .5rem 1rem; border: 1px solid var(--line); border-radius: .5rem;
    background: transparent; color: inherit; font: inherit; cursor: pointer;
  }
`;
