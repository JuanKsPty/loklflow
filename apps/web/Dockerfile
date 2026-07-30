# syntax=docker/dockerfile:1
#
# Imagen del frontend. El contexto de build es la RAÍZ del monorepo:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://api:3001 -t loklflow-web .
#
# DOS PUNTOS DE INYECCIÓN DISTINTOS, y confundirlos es el error clásico:
#
#   NEXT_PUBLIC_API_URL  se hornea en el bundle del navegador durante el build, así que va
#                        como ARG. Cambiarla después exige reconstruir la imagen.
#   JWT_SECRET           lo lee verifyToken() en cada petición del servidor de Next, así
#                        que va como variable de RUNTIME. Si se pasa como ARG queda dentro
#                        de la imagen y además no llega al proceso.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ─── Dependencias ────────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter @loklflow/web...

# ─── Compilación ─────────────────────────────────────────────────────────────────
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.json ./
# packages/types va entero y sin compilar: el web lo consume por transpilePackages, y su
# package.json apunta a src/index.ts.
COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter=web build

# ─── Runtime ─────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Sin esto el servidor escucha solo en localhost dentro del contenedor y nada externo
# alcanza el puerto publicado.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# La salida standalone ya trae su propio node_modules recortado por el trazado de Next, así
# que aquí no se instala nada. En un monorepo conserva la estructura de carpetas, por eso el
# servidor queda en apps/web/server.js y no en la raíz.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
# .next/static NO viaja dentro de standalone: hay que copiarlo aparte o todos los CSS y JS
# del cliente responden 404. (No hay carpeta public/ en este proyecto.)
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
