# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

This project uses **pnpm** exclusively. Never suggest `npm` or `yarn` commands.

```bash
pnpm install          # install all workspace dependencies
pnpm dev              # run all apps in dev mode via Turborepo
pnpm build            # build all apps
pnpm lint             # lint all workspaces
pnpm typecheck        # tsc --noEmit in all workspaces
pnpm test             # test all workspaces
pnpm format           # format with Prettier

# Target a specific app
pnpm dev --filter=api
pnpm dev --filter=web
pnpm test --filter=api
```

## Architecture

Turborepo monorepo with two apps and two shared packages:

```
apps/api     → NestJS 11 backend, runs on :3001, global prefix /api (Swagger en /api/docs)
apps/web     → Next.js 16 + React 19 + Tailwind v4, runs on :3000
packages/types   → shared TypeScript types (consumed by api and web)
packages/config  → shared ESLint flat config and TSConfig base
```

React components are **not** in a shared package — they live in
`apps/web/src/components/` (including the local shadcn `ui/` set).

Internal packages are referenced with the `workspace:*` protocol:
```json
"@loklflow/types": "workspace:*"
```

## Backend (apps/api)

- NestJS modules live under `src/<module>/` — each module owns its controller, service, and DTOs.
- All routes are prefixed with `/api` (set in `main.ts`).
- Build output goes to `dist/`, excluded from git.
- Jest config is in `jest.config.ts`, with `rootDir: src` — specs live **beside** the code
  they test (`src/orders/order-totals.spec.ts`), not in a separate `test/` directory.
- Run a single Jest test file: `pnpm --filter=api exec jest src/orders/order-totals.spec.ts`
- Every endpoint needs an explicit `@RequirePermissions('module:action')` or `@Public()`.
  `JwtAuthGuard` and `PermissionsGuard` are registered globally as `APP_GUARD`, so the
  default is deny.

### Integration tests

Two Jest configs. The unit ones (`*.spec.ts`, `rootDir: src`) need nothing; the
integration ones (`*.int-spec.ts`) boot the real `AppModule` against a real Postgres:

```bash
pnpm --filter=api test:int    # needs docker compose up -d postgres
```

They live **beside the code** like every other spec. The harness is in `apps/api/test/`:

- The database is `loklflow_test`, never the dev one. `test/env.ts` redirects it, and it
  has to rewrite the database **inside `DATABASE_URL`** — that variable takes precedence,
  so changing only `DATABASE_NAME` does nothing.
- `test/global-setup.ts` runs the migrations, which is how "the schema can be built from
  zero" gets verified on every run.
- `createTestApp()` replicates the globals from `main.ts` (prefix, `cookieParser`,
  `ValidationPipe`, exception filter). Do not drop any: without the pipe the tests would
  look like they validate DTOs while validating nothing.
- `cookieFor(['module:action'])` signs a session with exactly the permissions a test needs
  — `PermissionsGuard` reads them from the token, not from the DB. Use `sessionAs()` from
  `test/fixtures.ts` when the backend validates against the database (discount thresholds
  read the role; shifts are per user).
- `TZ` is forced to `America/Mexico_City`. CI runners are UTC, where a mismatch between the
  process's local time and the UTC that Postgres stores is invisible — that is how the
  report date-range bug reached production.
- A new `jest.*.config.ts` at the package root must be added to the `exclude` of
  `tsconfig.build.json`, or it raises the `rootDir` tsc infers and the output moves from
  `dist/main.js` to `dist/src/main.js`, breaking `start`.

### Database

The schema is versioned with TypeORM migrations in `src/database/migrations/`:

```bash
pnpm --filter=api migration:run        # apply pending migrations
pnpm --filter=api migration:generate src/database/migrations/<Name>
pnpm --filter=api seed                 # roles, permissions and demo users

# Same thing inside a container, from dist/ and without ts-node:
pnpm --filter=api migration:run:prod
pnpm --filter=api seed:prod
```

`synchronize` is only on when `NODE_ENV=development`. Outside dev the schema comes
from migrations only — never generate one against a DB that dev already synced, or the
diff comes out empty.

`DATABASE_URL` wins over the five loose `DATABASE_*` variables. `DATABASE_SSL=true` is only
for a managed Postgres.

Anything running outside Nest (the TypeORM CLI, the seed, the test bootstrap) loads the root
`.env` through `loadRootEnv()` in `src/config/load-root-env.ts`. Never hand-count the
relative path again: it was wrong in the seed and dotenv fails silently, so the connection
quietly falls back to the defaults and writes to the dev database.

**`orders.order_number` comes from the `orders_order_number_seq` sequence**, requested with
`nextval` in `OrdersService`. It used to be `MAX(order_number) + 1`, which handed the same
number to simultaneous requests. The sequence is deliberately *not* a column `DEFAULT`: with
one, `synchronize` sees a difference and crashes the dev boot.

**Idempotency, for the offline queue of Fase 4.** `POST /orders` and its items accept an
optional `id` generated by the device, which becomes the primary key; `POST
/orders/:id/payments` accepts `clientRequestId`. Both look the row up **before** writing —
never rely on catching a unique violation, because TypeORM's `save()` with an existing
primary key does an `UPDATE` and would silently overwrite the row.

**One open shift per cashier is enforced by `idx_shifts_one_open_per_user`**, a *partial*
unique index (`WHERE status = 'open'`). The check in `ShiftsService.openShift` is a
read-then-write, so a double click used to open two shifts and leave the arqueo meaningless —
payments split across both and neither balances. The service also translates the index
violation into the same `400`, so the race never surfaces as a 500.

**`GET /orders` is capped.** It defaults to 50 rows and rejects `take` above 200. It used to
return every order in the history with all its eager relations. Operational callers pass
`?open=true` and let the server filter; the only listing that wants history
(`/admin/orders`) passes an explicit `take` **and says on screen that it is showing the most
recent N** — a silent cap reads as "this is everything".

**Refresh tokens carry a unique `jti`.** Without it two logins by the same user inside the
same second produce a byte-identical JWT — the payload is deterministic and `iat` is in
seconds — and `refresh_tokens.token` is unique, so the second one died with a 500. PIN
sessions now issue refresh tokens too, so the collision became reachable daily.

**PIN sessions get a refresh token, with a shorter window** (`JWT_PIN_REFRESH_EXPIRES_IN`,
12h) than email ones. They used to get none, so the 4h access token expired mid-shift with no
way to renew and dumped the operator on `/login`, the email form, where they have no
credentials. And `refresh()` must propagate the original `loginMethod`: hardcoding `'email'`
downgraded a PIN session to 15 minutes and falsified the audit log.

**A cuenta cannot be closed with a balance.** `updateStatus` rejects `closed` while payments
are short; the legitimate close happens in `closeFromPayment`, which bypasses `updateStatus`.
The rule lives in the service, not the UI, so no future client — or a replayed offline
operation — can skip it.

### Registro y observabilidad

El logger es un `ConsoleLogger` **extendido** (`common/logging/app-logger.ts`) que solo añade
el `requestId`. Nunca extender `Logger`: `Logger.overrideLogger` lanza si recibe un
`instanceof Logger` con otro constructor. Y `ConsoleLoggerOptions` ya trae `json`, así que
escribir un logger propio sería trabajo tirado — con `json: true` los valores por defecto
(`colors: false`, `compact: true`) hacen que la salida pase por `JSON.stringify`: **una línea,
un JSON**, que es lo que el CI comprueba sobre la imagen. `LOG_FORMAT` fuerza el formato,
`LOG_LEVEL` es un **mínimo** (no un nivel único) y `LOG_HTTP` decide qué peticiones dejan línea
de acceso — por defecto solo las que fallan, porque `RealtimeRefresher` recarga a todos los
clientes ante cada evento y una acción humana son 12–18 peticiones.

El logger se pasa en las **opciones de `NestFactory.create`**, no con `app.useLogger()`: así
está puesto antes de construir el contenedor y un fallo de arranque sale con el mismo formato.

**El id de petición nace en un middleware registrado desde `AppModule.configure()`**, no con
`app.use()` en `main.ts`. Dos motivos, los dos verificados: los guards son `APP_GUARD` y
resuelven antes que cualquier interceptor, así que un id generado ahí faltaría justo en los 401
y 403; y `createTestApp()` replica los globales a mano sin ejecutar `main.ts`, así que puesto
allí tendría **cero cobertura** en los tests de integración. Un `x-request-id` entrante solo se
acepta si encaja en `/^[A-Za-z0-9_.:-]{8,64}$/` — el valor acaba en cada línea de log y sin
comprobarlo se pueden fabricar registros falsos con saltos de línea. Va también en
`exposedHeaders` de CORS y lo lee `client.ts`; sin eso la cabecera sería código muerto.

**`HttpExceptionFilter` registra la excepción, y eso es nuevo.** Al ser `@Catch()` global
desplaza al `BaseExceptionFilter` de Nest, que registraba con `logger.error(exception)` todo lo
que no fuera intrínseco: el filtro formateaba la respuesta y **tiraba el objeto**, así que
registrarlo había *quitado* el logging que Nest daba gratis. Se separa por severidad —5xx
`error` con pila, 401/403/404 `log`, el resto de 4xx `warn`— y no es estética: `TestingLogger`
silencia `log`, `warn`, `debug` y `verbose` pero **reenvía `error()`**, así que registrar los
4xx como error llenaría de trazas los tests de integración que los provocan a propósito.
La excepción se describe campo a campo (nunca volcando el objeto) porque `QueryFailedError`
lleva los `parameters` enlazados: un insert fallido en `users` pondría el hash bcrypt del PIN
en `docker logs`. Por lo mismo se omite `detail`, donde Postgres escribe los valores de la fila.

Ojo con un detalle de `ConsoleLogger`: pasar `undefined` como segundo argumento de `error()`
**no** equivale a omitirlo — lo imprime como un mensaje más y sale una línea con «undefined».

**`GET /api/ready` es un endpoint aparte, no un cambio en `/api/health`.** `health` no toca la
base a propósito: es lo que mira el `HEALTHCHECK` de la imagen y un proceso sano no debe
reiniciarse por un parpadeo de Postgres; además `guards.int-spec.ts` compara su cuerpo con
`toEqual({ status: 'ok' })`. `ready` sí consulta, con caché de 5 s y una sola comprobación en
vuelo (es `@Public()`: sin eso, cualquiera desde internet dispara un `SELECT 1` por petición),
y el motivo concreto del fallo se queda en el log — el mensaje del driver dice host y puerto.
La promesa que pierde la carrera con el temporizador lleva su propio `.catch()`: sin él, con la
base caída, el rechazo tardío llega como `unhandledRejection`.

`installProcessHandlers()` cubre lo que ocurre fuera de una petición. `uncaughtException` sale
del proceso, pero con 150 ms de margen: `process.stdout.write` es asíncrono cuando la salida es
una tubería —lo que hay en un contenedor— y salir de golpe se come la línea que explica la
caída. `unhandledRejection` **no** sale: esto es una caja registradora y una promesa suelta no
puede dejar al cajero sin sistema a media venta.

El gateway de realtime ya no es mudo, y sus rechazos van **deduplicados por origen**
(`LogThrottle`): el cliente de Socket.io reintenta cada pocos segundos para siempre, así que
una tablet olvidada con el token caducado escribiría decenas de miles de líneas idénticas por
noche. El tope de claves del throttle no es decoración — la clave lleva la IP.

## Frontend (apps/web)

- Next.js App Router — all routes under `src/app/`.
- Tailwind v4: configured via `@import "tailwindcss"` in `globals.css`. No `tailwind.config.ts`.
- PostCSS plugin is `@tailwindcss/postcss`, not the legacy `tailwindcss` plugin.
- Path alias `@/*` maps to `src/*`.
- Linting uses ESLint flat config (`eslint.config.js`). `next lint` was removed in Next 16.
- **All JWT verification goes through `src/lib/auth/jwt.ts`.** Never re-implement
  `jwtVerify` in a layout or in the proxy — it used to be triplicated, each copy with its
  own fallback secret.
- Route protection is declared in `src/proxy.ts` (`PROTECTED_PREFIXES`). Adding a new
  authenticated route section means adding it there too, not only relying on a layout redirect.
- Tests con **vitest** (`vitest.config.mts`, specs `src/**/*.spec.ts`, entorno node). El arnés
  entró por un solo archivo: `lib/observability/report.ts`, que decide qué sale hacia un log.
  Playwright y `fake-indexeddb` llegan con el núcleo offline.

### Errores y reporte

`error.tsx`, `global-error.tsx` y `not-found.tsx` existen porque sin ellos Next pinta lo suyo,
y lo suyo miente sobre el producto: un throw renderiza el `DefaultGlobalError` interno, que
**emite su propio `<html>` y reemplaza el RootLayout entero** (adiós fuentes, tema, `Toaster`),
y `notFound()` pinta un fallback con `<style>` en línea `body{color:#000;background:#fff}` que
**pisa el tema** y está en inglés en una app con `lang="es"`. `global-error.tsx` lleva sus
estilos en línea a propósito: una causa posible de llegar ahí es que la hoja no haya cargado.

`src/instrumentation.ts` (`onRequestError`) es el único gancho de reporte del lado servidor.
**Nunca recibe `notFound()` ni `redirect()`** —Next los descarta como errores de enrutado—, lo
cual es una suerte para los `redirect('/login')` de los layouts, y es la razón de que los
`catch` de las pantallas operativas tengan que llamar a `reportApiFailure()` por su cuenta: se
quedan el error y devuelven el aviso sin relanzar nada, así que ahí nunca aparecerían.

`lib/observability/report.ts` es la **única costura** hacia un log, y elige los campos uno a
uno: un `ApiError` lleva la respuesta del servidor en `data` y las librerías HTTP adjuntan la
petición entera con la cabecera `Authorization` dentro. Recorta mensaje y pila, y tacha lo que
tenga forma de JWT. Es lo único de `apps/web` con lógica de seguridad y por eso tiene spec.

`serverFetch` distingue **`ServerOfflineError`** (el `fetch` rechazó: no hay red) de
`ServerApiError` (el servidor contestó mal), y `ApiDownNotice` lo dice con palabras distintas
porque llevan a acciones distintas. `ServerApiError` fija su `name` —heredaba `'Error'`— y
guarda el `x-request-id` de la respuesta, que es lo que enlaza la línea del log de Next con la
de la API.

## Infrastructure

`docker-compose.yml` starts PostgreSQL 16 and Redis 7 only — apps run locally:

```bash
docker compose up -d   # start postgres + redis
docker compose down    # stop
```

Credentials and ports are defined in the **root** `.env` (copy from `.env.example`).

Both apps read that single root file, but neither finds it by default — the API passes
`envFilePath: ['../../.env']` to `ConfigModule.forRoot`, and `apps/web/next.config.ts`
loads it with `dotenv`. If you add a variable, also add it to `globalEnv` in `turbo.json`
so Turborepo doesn't cache across different values.

`JWT_SECRET` and `JWT_REFRESH_SECRET` have **no defaults**: the API throws on boot if
they are missing or still hold the `change-this-*` example value.

Redis is declared (`ioredis`, `redis.config.ts`) but **nothing connects to it**. It is kept
for the Socket.io adapter once there is more than one API instance; until then neither CI nor
a deployment needs it.

### Container images

One `Dockerfile` per app, both built **from the monorepo root** as context:

```bash
docker build -f apps/api/Dockerfile -t loklflow-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 -t loklflow-web .
```

Nothing is deployed yet — the point is that the repo stays deployable, and CI proves it by
building both images and booting them. Four things that are easy to break:

- Base is `node:22-slim`, **not alpine**: `bcrypt` is native and only ships prebuilt
  binaries for glibc, so musl makes it compile from source.
- `NEXT_PUBLIC_API_URL` is baked into the browser bundle at **build** time (`ARG`), while
  `JWT_SECRET` is read by `verifyToken` on every server request (**runtime** env var).
  Swapping them silently breaks either the API calls or every session.
- `.next/static` is **not** inside the standalone output and is copied in a separate step.
  Without it the pages load with no styles, and only fetching an asset catches it.
- Production dependencies are installed in the runner stage instead of copying
  `node_modules` from another one: pnpm links against a virtual store and the symlinks would
  point nowhere.

Migrations are not applied on boot — it is an explicit deploy step, so two instances
starting at once don't race on the same `ALTER TABLE`.

## Continuous Integration

`.github/workflows/ci.yml` runs on every push to `main` and every PR, in three jobs:
`verify` (lint, typecheck, test, build), `integration` (`test:int` against a `postgres:16`
service) and `images` (builds both images, applies migrations and the seed from the image,
then boots them and checks `/api/health`, a 401 on a protected route and that static assets
are served).

El job `images` comprueba además la observabilidad **sobre la imagen en marcha**, que es la
única forma: el formato del log depende de `NODE_ENV`, la cabecera depende de un middleware
registrado y `/api/ready` depende de que haya una base al otro lado. Exige que el
`x-request-id` viaje en la cabecera y en el cuerpo del error, que un id entrante válido se
respete, que **cada línea de `docker logs` sea un JSON con `level`**, y —parando el contenedor
de Postgres, que es el último paso del job— que `/api/ready` dé 503 mientras `/api/health`
sigue en 200 y que ese 5xx haya dejado una traza con su `requestId`.

JWT secrets are generated per run with `openssl rand -base64 48`. Building needs no secrets;
booting does.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth):      nueva funcionalidad de autenticación
fix(orders):     corrección en módulo de órdenes
docs(readme):    actualización de documentación
refactor(pos):   refactorización del punto de venta
test(sync):      pruebas de sincronización offline
chore(ci):       cambios en pipeline de CI/CD
```

Scope should match the affected module or app (`auth`, `menu`, `orders`, `pos`, `web`, `api`, `ci`, etc.).
