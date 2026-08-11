<div align="center">

# LoklFlow

**Sistema Integral de Gestión para Establecimientos F&B**

*Restaurantes · Bares · Cafeterías*

![Status](https://img.shields.io/badge/estado-en%20desarrollo-yellow?style=flat-square)
![License](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)
![Phase](https://img.shields.io/badge/fase%20actual-4%20%E2%80%94%20Offline%20y%20Resiliencia-blue?style=flat-square)
![Stack](https://img.shields.io/badge/stack-NestJS%20%7C%20Next.js%20%7C%20PostgreSQL-informational?style=flat-square)
![Monorepo](https://img.shields.io/badge/monorepo-Turborepo-EF4444?style=flat-square&logo=turborepo)

</div>

---

## ¿Qué es LoklFlow?

LoklFlow es una plataforma web de gestión operativa para establecimientos de alimentos y bebidas, con **servidor local e idempotente por diseño**. Centraliza en un solo sistema todo lo que necesita un negocio para operar: órdenes, menú, inventario, caja, roles de personal y reportes.

El servidor corre dentro del establecimiento y no en la nube, así que **una caída del enlace a internet no interrumpe la operación**. Aguantar que se caiga la propia red interna es otra cosa, y está a medias a propósito: el contrato del servidor está construido y probado —el uuid que genera el dispositivo es la clave primaria de la orden, los pagos aceptan `clientRequestId`, `order_number` sale de una secuencia—, pero **el runtime sin conexión del cliente todavía no existe**. Eso es la fase 4 y está al 15 %.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Monorepo** | Turborepo |
| **Backend** | NestJS · TypeScript · PostgreSQL · Redis |
| **Frontend** | Next.js · TypeScript · Tailwind CSS |
| **Infra** | Docker Compose (PostgreSQL + Redis) |
| **Calidad** | ESLint 10 (flat config) · TypeScript strict · Jest (unitarios + integración) |
| **CI** | GitHub Actions · imágenes de Docker de las dos apps |

---

## Arquitectura

```
                    ☁️  NUBE
                 (Dashboard remoto
                  + Menú QR público
                  + Backup automático)
                        │
              sync cuando hay internet
                        │
          ┌─────────────▼────────────┐
          │    SERVIDOR LOCAL         │
          │   NestJS + PostgreSQL     │  ← Corre en el establecimiento
          │   Redis + Socket.io       │  ← Con UPS de respaldo
          └─────────────┬────────────┘
                        │
                  Red WiFi interna
                        │
        ┌───────┬────────┴───────┬──────────┐
        │       │                │          │
      POS    Mesero           Cocina     Cliente
    (caja)  (móvil)        (pantalla)    (QR)
```

El sistema opera **sin depender de internet**: servidor, base de datos y clientes viven en la misma red interna, y la nube sólo hace falta para el tablero remoto y el respaldo.

Lo que **todavía no** hace, y conviene decirlo aquí y no en la letra chica: si se cae la red interna o el servidor, los clientes no siguen trabajando. Las 42 pantallas son Server Components que piden datos sin caché, así que hoy no renderizan sin servidor, y no hay Service Worker ni base de datos en el cliente ni cola de sincronización. Lo que sí está hecho es la mitad del servidor, que es la que no se puede añadir después: reenviar una operación devuelve el estado en lugar de duplicar el cobro, y eso está afirmado por pruebas de integración contra un PostgreSQL real.

---

## Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| **Super Admin** | Dueño. Acceso total. Configura roles, menú, mesas y empleados. |
| **Gerente** | Gestiona turnos, aprueba descuentos, ve reportes. |
| **Cajero** | Opera el POS, procesa pagos, cierra turno. |
| **Mesero** | Toma órdenes desde móvil, gestiona sus mesas. |
| **Cocina** | Ve la cola de órdenes en tiempo real en el KDS. |
| **Cliente** | Accede al menú vía QR y ordena desde su teléfono. |

> Los roles son completamente configurables. El Super Admin puede crear roles personalizados con permisos granulares por módulo.

---

## Roadmap de Desarrollo

El proyecto se construye en 6 fases (Fundación → Columna Vertebral → Core → Caja → Offline → Inventario → Pulido). Cada fase tiene un entregable funcional independiente.

Detalle completo en [docs/ROADMAP.md](./docs/ROADMAP.md).

---

## Estado Actual

```
Fase 0 ████████████████████ 100%  — Completada
Fase 1 ████████████████████ 100%  — Completada (desplegado en producción)
Fase 2 ████████████████████ 100%  — Completada (incluida la fusión de mesas)
Fase 3 ████████████████████ 100%  — Completada
Fase 4 ████████████████████ 100%  — Completada (offline y sincronización)
Fase 5 ████████████████████ 100%  — Completada (inventario y menú QR)
Fase 6 ████████████████████ 100%  — Completada (seguridad, cobertura, e2e y pulido)
```

Diferidos a conciencia, no olvidados: envío del recibo por correo y exportación a PDF/Excel
(Fase 3). El resto del alcance está entregado.

### El sistema en marcha

| | |
|---|---|
| ![Salón del mesero](./docs/images/01-salon.png) | ![Tomando la comanda](./docs/images/02-comanda.png) |
| **Salón** — mesas por sector con su estado en color | **Comanda** — se toca el producto, el total sube solo |
| ![KDS de cocina](./docs/images/03-cocina.png) | ![Cobro en caja](./docs/images/05-cobro.png) |
| **Cocina** — la comanda aparece **sin recargar**, en otra pantalla | **Caja** — cobro, split y propina; al saldarse libera la mesa |

> Las capturas las produce la propia suite de e2e (`E2E_CAPTURAS=1`), recorriendo el flujo real
> contra la API y la base. Se regeneran cuando cambia la interfaz en vez de pudrirse — el guion
> del recorrido está en [`docs/DEMO.md`](./docs/DEMO.md).

### Módulos implementados

| Módulo | Descripción |
|--------|-------------|
| **Auth + RBAC** | Login email/PIN, JWT + refresh, roles y permisos granulares, panel admin, auditoría |
| **Menú** | Categorías, productos, modificadores, combos y disponibilidad por horario |
| **Mesas y Sectores** | Sectores, mesas (número único global, estados), reservas y **editor visual de distribución** (drag-and-drop, zonas, formas, creación masiva) |
| **Órdenes** | Órdenes con ítems y modificadores, cálculo de totales, flujo de estados con historial de transiciones |
| **Tiempo real** | WebSockets (Socket.io) con handshake autenticado por cookie; órdenes y estado de mesas se actualizan en vivo en el panel sin recargar |
| **Vista de mesero** | App móvil (`/waiter`, login por PIN): salón con mesas por sector, tomar orden con modificadores, avanzar estados y cambiar estado de mesa, todo en vivo |
| **KDS de cocina** | Pantalla dedicada (`/kitchen`, login por PIN): tablero por columnas (pendientes/en preparación/listas) con tiempo transcurrido, avance por orden en vivo |
| **Notificaciones** | Avisos persistidos entre roles (campana con no leídas + bandeja): cocina recibe órdenes nuevas, el mesero recibe "orden lista"; push por WebSocket y persistencia en BD |
| **Caja / POS** | Cobro de cuentas (`/pos` del cajero y desde la cuenta del mesero): múltiples métodos, split en pagos parciales, propina; cierra la cuenta y libera la mesa automáticamente |
| **Turnos de caja** | Apertura/cierre de turno por cobrador con fondo inicial; cada pago se sella al turno y el cobro exige turno abierto; al cerrar, arqueo automático (ventas por método, efectivo esperado vs. contado y diferencia) |
| **Descuentos** | Umbral por rol: si el descuento cabe en el límite se aplica al instante, si lo excede queda pendiente y le llega un aviso al gerente, que lo resuelve en `/admin/approvals`. Motivo obligatorio y todo el flujo auditado. Se rechaza si dejaría el total por debajo de lo ya cobrado |
| **Recibo** | Vista de 80 mm en `/recibo/[id]` con los datos fiscales del negocio, desglose del IVA contenido en el precio y los pagos registrados; impresión directa del navegador, sin librerías |
| **Panel de métricas** | `/admin` con ventas cobradas, ticket promedio, cuentas abiertas, tiempo medio de preparación, top de productos y reparto por método de pago; se actualiza en vivo al cerrar una cuenta |
| **Reportes** | Exportación de ventas a CSV por rango de fechas (con BOM y CRLF para Excel) |
| **Auditoría** | 18 acciones críticas con actor, IP y valor anterior; consulta paginada y filtrable en `/admin/audit`. Las credenciales se redactan antes de persistir |
| **Idempotencia** | Preparación del modo sin conexión: el uuid que genera el dispositivo es la clave primaria de la orden y de sus ítems, y los pagos aceptan `clientRequestId`. Reenviar una operación devuelve el estado en lugar de duplicar la cuenta o el cobro. `order_number` sale de una secuencia de Postgres |
| **Inventario** | Ingredientes con unidad y mínimo, proveedores, recetas por producto y movimientos de stock (entrada, merma, ajuste). El cierre de cuenta descuenta el consumo de forma idempotente, así que un cobro reenviado no resta dos veces |
| **Modo sin conexión** | Cola de operaciones en IndexedDB con orden por cuenta, reintentos con espera creciente y cerrojo entre pestañas; las tres superficies operativas leen del dispositivo y siguen funcionando con la API caída. Cobrar y abrir turno siguen exigiendo red **a propósito**. Documentado en [`docs/OFFLINE.md`](./docs/OFFLINE.md) |
| **Menú QR** | Código por mesa con rotación e impresión en hoja; el cliente abre `/m/[código]`, ve el menú filtrado por disponibilidad horaria y pide desde su teléfono sin instalar nada ni tener cuenta. Seguimiento del pedido con un token de invitado que caduca |
| **Fusión de cuentas** | Juntar varias cuentas en una antes de cobrar, con deshacer exacto. Las cuentas fusionadas quedan fuera de los listados y de los reportes, que si no contarían las ventas dos veces |
| **CI/CD** | Tres jobs en GitHub Actions: lint, tipos, pruebas unitarias, build y dos suites de e2e en un navegador de verdad · integración contra un Postgres real, con las migraciones aplicadas desde cero y umbral de cobertura · construcción de las dos imágenes de Docker, que se arrancan para comprobar salud, cabeceras, formato del log y estáticos |

> **API documentada** con Swagger en `/api/docs`. Solo fuera de producción.

---

## Documentación

| Documento | Descripción | Estado |
|-----------|-------------|--------|
| [Visión del Proyecto (RUP)](./docs/LoklFlow_Vision_v1.0_1.docx) | Alcance, usuarios, requerimientos y riesgos | ✅ Completo |
| [Roadmap de Desarrollo](./docs/ROADMAP.md) | Fases, tareas y entregables del proyecto | ✅ Completo |
| [Modelo de Base de Datos](./docs/DATA_MODEL.md) | Tablas, relaciones y decisiones de diseño | ✅ Completo |
| [Sistema de Diseño](./docs/design-system.md) | Tokens, tipografía, densidad táctil y patrones de pantalla | ✅ Completo |
| [Sincronización sin conexión](./docs/OFFLINE.md) | Qué se difiere, la vida de una operación, conflictos y límites conocidos | ✅ Completo |
| [Seguridad](./docs/SECURITY.md) | Auditoría OWASP Top 10 con los riesgos residuales aceptados | ✅ Completo |
| [Demo](./docs/DEMO.md) | Guion del recorrido, minutado y cómo regenerar las capturas | ✅ Completo |

> El esquema lo construyen las migraciones de `apps/api/src/database/migrations/`, y el CI lo
> levanta desde cero en cada ejecución. La cuenta exacta de tablas no se cita aquí a propósito:
> derivó tres veces y la fuente de verdad es la carpeta.

---

## Estructura del Proyecto

```
loklflow/
├── .github/workflows/ci.yml    # verify · integration · images
├── apps/
│   ├── api/                    # Backend NestJS
│   │   ├── Dockerfile          # contexto de build: la raíz del monorepo
│   │   ├── test/               # arnés de integración (arranque, sesiones, fixtures)
│   │   └── src/
│   │       ├── auth/           # JWT + refresh, login por email y por PIN
│   │       ├── users/
│   │       ├── roles/          # RBAC granular por módulo:acción
│   │       ├── business-config/
│   │       ├── audit/
│   │       ├── menu/           # categorías, productos, modificadores, combos
│   │       ├── tables/         # sectores, mesas, reservas
│   │       ├── orders/
│   │       ├── payments/       # cobro, split, propina
│   │       ├── shifts/         # turnos de caja y arqueo
│   │       ├── notifications/
│   │       ├── discounts/      # umbral por rol y aprobaciones
│   │       ├── inventory/      # ingredientes, proveedores, recetas y stock
│   │       ├── reports/        # agregados y exportación a CSV
│   │       ├── public/         # menú QR: la única superficie anónima
│   │       ├── realtime/       # gateway de Socket.io
│   │       ├── common/         # guards, decoradores, filtros, pipes
│   │       └── database/       # migraciones y seeds
│   └── web/                    # Frontend Next.js
│       ├── Dockerfile          # salida standalone
│       └── src/
│           ├── app/
│           │   ├── (auth)/     # login y login por PIN
│           │   ├── (dashboard)/admin/   # panel de administración
│           │   ├── (print)/    # recibo de 80 mm, sin barra ni cabecera
│           │   ├── pos/        # vista del cajero
│           │   ├── waiter/     # vista del mesero (móvil)
│           │   └── kitchen/    # KDS de cocina
│           │   └── (public)/m/ # menú QR, sin sesión
│           ├── components/     # incluye ui/ (shadcn) por app
│           ├── hooks/
│           └── lib/
│               ├── offline/    # cola, caché local y superposición de pendientes
│               ├── api/
│               └── observability/
│       ├── e2e/                # Playwright: núcleo sin conexión y servicio completo
│       └── public/             # Service Worker, manifiesto e iconos
├── packages/
│   ├── types/                  # tipos TypeScript compartidos
│   └── config/                 # ESLint flat config y TSConfig base
├── docs/                       # documentación técnica
├── turbo.json
├── docker-compose.yml          # solo postgres y redis; las apps corren en local
├── .dockerignore
├── .env.example
└── README.md
```

---

## Cómo Correr el Proyecto

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/loklflow.git
cd loklflow

# Copiar variables de entorno
cp .env.example .env

# Generar los secretos JWT — la API se niega a arrancar con los valores de ejemplo
openssl rand -base64 48    # → JWT_SECRET
openssl rand -base64 48    # → JWT_REFRESH_SECRET

# Levantar PostgreSQL y Redis (las apps corren en local)
docker compose up -d

# Instalar dependencias (pnpm gestiona el monorepo con Turborepo)
pnpm install

# Crear el esquema y cargar los datos iniciales
pnpm --filter=api migration:run
pnpm --filter=api seed

# Correr todos los servicios en desarrollo
pnpm dev

# Correr solo un app específico
pnpm dev --filter=api
pnpm dev --filter=web
```

### Calidad

```bash
pnpm lint         # ESLint 10 en las 3 workspaces
pnpm typecheck    # tsc --noEmit
pnpm test         # unitarias: funciones puras del backend, tipos y componentes del web

# Integración: la app real contra un Postgres real. Usa la base loklflow_test, nunca la de
# desarrollo, y aplica las migraciones desde cero — así se comprueba que el esquema se puede
# levantar de la nada en cada ejecución.
docker compose up -d postgres
pnpm --filter=api test:int

# Lo mismo, más las unitarias, con cobertura y umbral. Es lo que corre el CI.
pnpm --filter=api test:cov:all

# e2e en un navegador de verdad, contra el build de producción. Son dos suites:
pnpm --filter=web build && pnpm --filter=web test:e2e            # núcleo sin conexión
pnpm --filter=web build:e2e && pnpm --filter=web test:e2e:servicio  # con la API y la base vivas
```

> Las dos suites de e2e necesitan builds distintos: `NEXT_PUBLIC_API_URL` se hornea en el
> bundle, así que un mismo build no puede a la vez hablar con una API viva y no tener ninguna
> al otro lado. `build:e2e` fija la variable y el puerto a la vez.

Los mismos pasos, más las imágenes de Docker, corren en GitHub Actions en cada push y cada PR
(`.github/workflows/ci.yml`).

### Rendimiento

La mitad **determinista** está automatizada y corre en cada PR: `jsx-a11y` en el lint y
`@axe-core/playwright` sobre cinco pantallas, exigiendo cero violaciones `serious` o `critical`.

Lighthouse **no** es un paso de CI, a propósito: sobre un servidor standalone en un runner
compartido tiene una varianza de ±10 puntos y crea un gate intermitente que la gente aprende a
relanzar en vez de a arreglar. Se mide a mano, contra el build de producción:

```bash
pnpm --filter=web build
node apps/web/.next/standalone/apps/web/server.js &   # necesita el cp de .next/static y public/
pnpm dlx lighthouse http://localhost:3000/login --preset=desktop --view
```

Lo que sí se puede afirmar sin varianza es el peso del bundle, que sale del propio build. Las
optimizaciones que hizo la Fase 6 fueron tres, y las tres tienen un motivo concreto:

- `recharts` —la dependencia más pesada— sale del arranque de `/admin` con `next/dynamic`. Era
  carga síncrona en la primera pantalla que ve el dueño, para dos gráficas que están por debajo
  del pliegue.
- `/pos` pedía el turno de caja **dos veces** en cada carga: el layout y la página. Ahora
  comparten un helper envuelto en `cache()` de React.
- Diez `loading.tsx` cubren las rutas que hacen entre dos y seis peticiones antes de pintar. No
  las 26 pantallas de alta y edición: un esqueleto para cuarenta milisegundos es un parpadeo.

En desarrollo el esquema se sincroniza solo (`synchronize: true` cuando
`NODE_ENV=development`). Fuera de desarrollo el esquema se aplica **solo** con
migraciones — nunca con `synchronize`.

---

## Despliegue

Vive en **Dokploy**, con un solo origen tras Traefik: `/api` y `/socket.io` van al backend y todo
lo demás al web. Esa topología no es un detalle de infraestructura, cambia dos decisiones del
código y las dos están comentadas donde importan:

- El **Service Worker filtra por path**, no por origen. `url.origin !== self.location.origin`
  funciona en desarrollo (:3000 contra :3001) y **en producción no filtra nada**, porque la API es
  el mismo origen. La regla que sostiene «no cachear respuestas autenticadas» es saltar `/api` y
  `/socket.io`.
- El **`connect-src` del CSP** se deriva de `NEXT_PUBLIC_API_URL`, incluida su forma `wss://`.
  En producción bastaría `'self'`; en desarrollo hace falta nombrar el puerto.

### El orden importa

1. **Las migraciones primero, y a mano.** No se aplican al arrancar: dos instancias levantando a
   la vez se pelearían por el mismo `ALTER TABLE`. Es un paso explícito
   (`migration:run:prod && seed:deploy`).
2. **La API antes que el web.** Varios cambios son contratos de servidor —la hora del hecho de la
   cola sin conexión, la versión de sesión—, y un web nuevo contra una API vieja manda toda la
   cola a la bandeja de fallos.
3. **`seed:deploy`, nunca `seed:prod`.** El segundo crea cuatro usuarios de demostración con
   credenciales publicadas en un repositorio público.
4. **`NEXT_PUBLIC_API_URL` se hornea en el build.** Cambiar de host obliga a reconstruir la imagen
   del web, no a cambiar una variable de entorno.

Ninguna migración del proyecto es destructiva: todas son columnas nuevas con valor por defecto o
nulables, así que la API vieja sigue funcionando contra el esquema nuevo. Eso es justamente lo que
permite migrar **antes** de desplegar.

`JWT_SECRET` y `JWT_REFRESH_SECRET` no tienen valores por defecto: la API se niega a arrancar si
faltan o si conservan el `change-this-*` del ejemplo.

---

## Licencia

MIT © 2026 — LoklFlow