import type { Instrumentation } from 'next';
import { reportServerError } from '@/lib/observability/report';

/**
 * El único gancho de reporte del lado servidor que ofrece Next.
 *
 * Recibe todo lo que revienta renderizando en el servidor —Server Components, layouts,
 * route handlers— antes de que se convierta en un `digest` opaco para el navegador.
 *
 * Lo que **no** recibe: `notFound()` ni `redirect()`. Next los descarta como errores de
 * enrutado antes de llegar aquí. Es una buena noticia para los siete `redirect('/login')` de
 * los layouts, que si no inundarían el log con cada sesión caducada; y es la razón de que los
 * `catch` de las pantallas operativas tengan que reportar por su cuenta: se quedan el error y
 * devuelven el aviso de sin conexión sin relanzar nada, así que aquí nunca aparecerían.
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  reportServerError('next', err, {
    path: request.path,
    method: request.method,
    router: context.routerKind,
    routeType: context.routeType,
  });
};

export async function register(): Promise<void> {
  // Los manejadores de proceso viven en otro archivo y se cargan con un import dinámico
  // **dentro** de la condición, no detrás de un `if` con el `process.on` a la vista.
  //
  // Este archivo se compila también para el runtime edge, y el análisis del bundler es
  // estático: una simple mención de `process.on` en el módulo rompe el build con «A Node.js
  // API is used ... which is not supported in the Edge Runtime», aunque en ejecución nunca
  // se llegue a esa línea. Con el import dinámico, el módulo de Node ni se analiza.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
