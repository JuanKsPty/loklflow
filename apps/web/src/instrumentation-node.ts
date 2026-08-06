import { reportServerError } from '@/lib/observability/report';

/**
 * Fallos del proceso del servidor de Next, los que ocurren fuera del renderizado de una
 * petición y que por tanto `onRequestError` nunca ve.
 *
 * Está en un archivo aparte, cargado con `await import()` desde `register()`, porque
 * `instrumentation.ts` se compila también para el runtime edge y el bundler analiza de forma
 * estática: mencionar `process.on` allí rompe el build aunque esté detrás de una condición.
 */

process.on('unhandledRejection', (reason: unknown) => {
  reportServerError('unhandledRejection', reason);
});

process.on('uncaughtException', (error: Error) => {
  reportServerError('uncaughtException', error);
  // No se sale del proceso, y es deliberado: desde Node 15 el comportamiento por defecto es
  // tumbarlo, y dejar sin interfaz a un salón entero por una excepción suelta en una petición
  // es peor que seguir sirviendo el resto de pantallas. Si el proceso quedara de verdad
  // inservible, el healthcheck del contenedor lo detecta y lo reinicia.
});
