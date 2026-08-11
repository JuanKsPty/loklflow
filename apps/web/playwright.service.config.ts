import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// El `.env` de la raíz, que es donde vive `DATABASE_URL`. Igual que hace `next.config.ts`.
loadEnv({ path: '../../.env', quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3200);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Puerto de la API. **Tiene que coincidir con el `NEXT_PUBLIC_API_URL` con el que se construyó
 * `apps/web`**, porque esa variable se hornea en el bundle: de ahí el script `build:e2e`, que
 * fija los dos a la vez. Un 3001 por defecto habría chocado con cualquier `pnpm dev` abierto.
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 3101);
const API_URL = `http://127.0.0.1:${API_PORT}`;

/** Base dedicada. Nunca `loklflow_test`: la suite de integración la trunca entera. */
const E2E_DATABASE = process.env.E2E_DATABASE_NAME ?? 'loklflow_e2e';

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

const DATABASE_URL = withDatabase(
  process.env.DATABASE_URL ?? 'postgresql://loklflow:loklflow@localhost:5432/loklflow_db',
  E2E_DATABASE,
);

/**
 * Los secretos que la API exige para arrancar. Si el `.env` de la raíz trae unos buenos se usan
 * esos; si no, unos fijos para la ejecución. Lo que no puede quedar es el `change-this-*` de
 * ejemplo: la API se niega a arrancar con él, a propósito.
 */
const usable = (value: string | undefined) =>
  value && !value.startsWith('change-this') ? value : undefined;

const JWT_SECRET =
  usable(process.env.JWT_SECRET) ?? 'clave-solo-para-e2e-que-no-vale-en-ningun-sitio';
const JWT_REFRESH_SECRET =
  usable(process.env.JWT_REFRESH_SECRET) ?? 'refresco-solo-para-e2e-que-no-vale-en-ningun-sitio';

/**
 * El e2e **de servicio**: el producto entero, con la API y Postgres de verdad.
 *
 * Es la otra mitad de `playwright.config.ts`, que corre el núcleo sin conexión con la red
 * interceptada. Van en dos configuraciones y no en dos proyectos porque necesitan **builds
 * distintos** del web: `NEXT_PUBLIC_API_URL` se hornea, y un bundle no puede apuntar a la vez a
 * una API viva y a ninguna.
 *
 * La API arranca desde `dist/`, no con `nest start`: se prueba lo que se despliega.
 *
 * Las sesiones salen de un proyecto de preparación que **recorre el login real** —`/login` y
 * `/pin/[userId]`, las dos pantallas que si no nadie ejercitaría— y guarda el `storageState`.
 */
export default defineConfig({
  testDir: './e2e',
  // Un recorrido de tres roles con esperas de socket no cabe en los 30 s por defecto; el
  // arranque de los servidores tiene su propio tope, aparte.
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  // En serie siempre: comparten una sola base de datos y se truncan entre sí. Paralelizar sería
  // inventarse fallos que no existen.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'preparacion',
      testMatch: /support\/auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'servicio',
      testMatch: /(servicio|caja|seguridad|a11y)\.spec\.ts/,
      dependencies: ['preparacion'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // 390×844, un Pixel 7. Es la mitad automatizable de «responsive»: que nada se desborde a
      // lo ancho. Lo demás es una captura que alguien mira.
      name: 'movil',
      testMatch: /responsive\.spec\.ts/,
      dependencies: ['preparacion'],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      // Prepara la base **antes** de arrancar. Playwright levanta los `webServer` antes de su
      // propio `globalSetup`, así que este encadenado es el único sitio donde el orden está
      // garantizado; sin esquema, la API se cae al conectar y el arranque no termina nunca.
      command: 'pnpm db:e2e && node dist/main.js',
      cwd: '../api',
      // `/api/health` no toca la base a propósito: es la sonda de vida, y aquí lo que interesa
      // saber es que el proceso está en pie.
      url: `${API_URL}/api/health`,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL,
        JWT_SECRET,
        JWT_REFRESH_SECRET,
        CORS_ORIGINS: BASE_URL,
        // Solo los fallos: con las líneas de acceso, el arranque de la API entierra la salida
        // de Playwright — `RealtimeRefresher` son 12–18 peticiones por acción humana.
        LOG_HTTP: 'errors',
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command:
        'cp -R .next/static .next/standalone/apps/web/.next/ && cp -R public .next/standalone/apps/web/ && node .next/standalone/apps/web/server.js',
      url: BASE_URL,
      env: {
        PORT: String(PORT),
        HOSTNAME: '127.0.0.1',
        JWT_SECRET,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
