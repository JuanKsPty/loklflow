# syntax=docker/dockerfile:1
#
# Imagen de la API. El contexto de build es la RAÍZ del monorepo, no apps/api:
#   docker build -f apps/api/Dockerfile -t loklflow-api .
#
# node:22-slim y no alpine a propósito: bcrypt es un módulo nativo y solo publica binarios
# precompilados para glibc. En alpine (musl) no encuentra ninguno y se pone a compilar,
# lo que obliga a meter python3, make y g++ en la imagen.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ─── Dependencias ────────────────────────────────────────────────────────────────
# Solo los manifiestos y el lockfile: mientras no cambien, Docker reutiliza esta capa y
# no vuelve a instalar nada. Van todos los package.json de los workspaces porque
# --frozen-lockfile compara el lockfile contra el conjunto completo y falla si falta uno,
# aunque luego se filtre por un solo paquete.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter @loklflow/api...

# ─── Compilación ─────────────────────────────────────────────────────────────────
FROM deps AS build
# tsconfig.json de la raíz: el de apps/api lo extiende.
COPY tsconfig.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter=api build

# ─── Runtime ─────────────────────────────────────────────────────────────────────
# Las dependencias de producción se instalan aquí en lugar de copiarlas de otra etapa:
# pnpm enlaza node_modules contra su store virtual (node_modules/.pnpm) con symlinks, y
# copiarlos entre etapas los deja apuntando a rutas que no existen.
FROM base AS runner
ENV NODE_ENV=production
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --prod --filter @loklflow/api...

COPY --from=build /app/apps/api/dist apps/api/dist

WORKDIR /app/apps/api
USER node
EXPOSE 3001

# `/api/health` está marcado @Public(), así que responde sin credenciales. Se usa fetch de
# Node en lugar de curl porque la imagen slim no trae curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Las migraciones NO se aplican al arrancar: es un paso explícito del despliegue, para que
# dos instancias arrancando a la vez no compitan por el mismo ALTER TABLE.
#   docker run --rm loklflow-api pnpm migration:run:prod
CMD ["node", "dist/main"]
