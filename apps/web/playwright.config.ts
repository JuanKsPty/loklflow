import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * El e2e **aislado**: el núcleo sin conexión, con la red interceptada.
 *
 * Aquí no se levanta la API a propósito. Lo que hay que comprobar de la cola es *la petición
 * exacta que reproduce* —método, ruta, cuerpo, `occurredAt`, clave de idempotencia—, y eso se
 * afirma con un grabador, no consultando el estado final de una base. Además necesita que el
 * `fetch` **rechace**, que es lo que produce un `OfflineError` de verdad; un servidor devolviendo
 * 503 no vale, porque la cola trata eso como una decisión del servidor y no como falta de red.
 *
 * El flujo completo contra la API y la base reales tiene su propia configuración,
 * `playwright.service.config.ts`. Están separadas por un motivo concreto y no por gusto:
 * `NEXT_PUBLIC_API_URL` se **hornea en el bundle durante el build**, así que un mismo build no
 * puede a la vez hablar con una API real y no tener ninguna al otro lado. Y no basta con
 * interceptar en el navegador: los cascarones de servidor llaman a `serverFetch` desde el proceso
 * de Next, donde `page.route()` no llega — con una API viva, `/waiter/orden/<id-inventado>`
 * respondería 404 y la pantalla sería un `notFound()` en vez de la vista que se quiere probar.
 *
 * Contra el **build de producción** y no contra `next dev`: en desarrollo el Service Worker se
 * comporta distinto y la salida standalone ni existe.
 */
export default defineConfig({
  testDir: './e2e',
  // Solo los aislados. Los de servicio los recoge la otra configuración.
  testMatch: /(humo|offline-sync|offline-conflict|service-worker)\.spec\.ts/,
  // Sin reintentos en local: un test que solo pasa a la segunda es un test que miente. En CI
  // uno, para no bloquear un merge por un arranque lento del servidor.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // El servidor standalone, que es el que va dentro de la imagen. `pnpm start` levantaría
    // otro distinto y probaríamos algo que no se despliega.
    //
    // El `cp` no es un apaño: **`.next/static` no forma parte de la salida standalone**, y el
    // Dockerfile lo copia en un paso aparte por eso mismo. Replicarlo aquí es lo que hace que
    // la prueba de los estilos signifique algo — sin él fallaría siempre, y con `pnpm start`
    // pasaría siempre, que es peor: dejaría de vigilar el `COPY` que de verdad puede
    // desaparecer del Dockerfile.
    // `public/` corre la misma suerte: tampoco viaja dentro de standalone, y ahí están el
    // Service Worker y el manifiesto. Sin copiarlo, `/sw.js` daría 404 aquí y las pruebas del
    // modo sin conexión pasarían por no haber registrado nunca un SW — verdes por vacío.
    command:
      'cp -R .next/static .next/standalone/apps/web/.next/ && cp -R public .next/standalone/apps/web/ && node .next/standalone/apps/web/server.js',
    url: BASE_URL,
    env: {
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      // `verifyToken` lo lee en cada petición del servidor de Next y rechaza el valor de
      // ejemplo, así que sin uno propio toda ruta protegida rebotaría a /login.
      JWT_SECRET: process.env.JWT_SECRET ?? 'clave-solo-para-e2e-que-no-vale-en-ningun-sitio',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
