import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright contra el **build de producción**, no contra `next dev`.
 *
 * Entra en este bloque aunque todavía no haya nada sin conexión que enseñar, y es deliberado:
 * el cascarón y el Service Worker del bloque siguiente no se pueden ejercitar de ninguna otra
 * forma —`context.setOffline(true)` necesita un navegador de verdad— y escribirlos sin arnés
 * es exactamente como ese bloque se tuerce. De momento sostiene tres pruebas de humo que hoy
 * ya son ciertas; empieza a ganarse el sueldo en cuanto exista el cascarón.
 *
 * Contra producción y no contra dev porque es donde vive lo que hay que probar: en desarrollo
 * el Service Worker se comporta distinto y la salida standalone ni existe.
 */
export default defineConfig({
  testDir: './e2e',
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
    command:
      'cp -R .next/static .next/standalone/apps/web/.next/ && node .next/standalone/apps/web/server.js',
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
