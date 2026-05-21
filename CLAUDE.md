# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

This project uses **pnpm** exclusively. Never suggest `npm` or `yarn` commands.

```bash
pnpm install          # install all workspace dependencies
pnpm dev              # run all apps in dev mode via Turborepo
pnpm build            # build all apps
pnpm lint             # lint all apps
pnpm test             # test all apps
pnpm format           # format with Prettier

# Target a specific app
pnpm dev --filter=api
pnpm dev --filter=web
pnpm test --filter=api
```

## Architecture

Turborepo monorepo with two apps and three shared packages:

```
apps/api     → NestJS 11 backend, runs on :3001, global prefix /api
apps/web     → Next.js 15 + React 19 + Tailwind v4, runs on :3000
packages/ui      → shared React components (consumed by web)
packages/types   → shared TypeScript types (consumed by api and web)
packages/config  → shared ESLint and TSConfig base configs
```

Internal packages are referenced with the `workspace:*` protocol:
```json
"@loklflow/types": "workspace:*"
```

## Backend (apps/api)

- NestJS modules live under `src/<module>/` — each module owns its controller, service, and DTOs.
- All routes are prefixed with `/api` (set in `main.ts`).
- Build output goes to `dist/`, excluded from git.
- Run a single Jest test file: `pnpm --filter=api exec jest src/auth/auth.service.spec.ts`

## Frontend (apps/web)

- Next.js App Router — all routes under `src/app/`.
- Tailwind v4: configured via `@import "tailwindcss"` in `globals.css`. No `tailwind.config.ts`.
- PostCSS plugin is `@tailwindcss/postcss`, not the legacy `tailwindcss` plugin.
- Path alias `@/*` maps to `src/*`.

## Infrastructure

`docker-compose.yml` starts PostgreSQL 16 and Redis 7 only — apps run locally:

```bash
docker compose up -d   # start postgres + redis
docker compose down    # stop
```

Credentials and ports are defined in `.env` (copy from `.env.example`).

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
