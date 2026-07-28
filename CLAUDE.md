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
apps/api     → NestJS 11 backend, runs on :3001, global prefix /api
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

### Database

The schema is versioned with TypeORM migrations in `src/database/migrations/`:

```bash
pnpm --filter=api migration:run        # apply pending migrations
pnpm --filter=api migration:generate src/database/migrations/<Name>
pnpm --filter=api seed                 # roles, permissions and demo users
```

`synchronize` is only on when `NODE_ENV=development`. Outside dev the schema comes
from migrations only — never generate one against a DB that dev already synced, or the
diff comes out empty.

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
