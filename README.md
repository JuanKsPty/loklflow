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

LoklFlow es una plataforma web **offline-first** de gestión operativa para establecimientos de alimentos y bebidas. Centraliza en un solo sistema todo lo que necesita un negocio para operar: órdenes, menú, inventario, caja, roles de personal y reportes.

Diseñado para funcionar **aunque se caiga el WiFi o la luz**, con sincronización automática al recuperar la conexión.

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

El sistema opera **completamente sin internet**. Si se cae la conexión, el personal sigue trabajando normalmente. Los datos se sincronizan automáticamente al recuperar la conexión.

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
Fase 1 ███████████████████░   95%  — CI/CD e imágenes listas; deploy aplazado a propósito
Fase 2 ███████████████████░   95%  — Casi lista (solo fusión de mesas, diferida)
Fase 3 ████████████████████ 100%  — Completada
Fase 4 ███░░░░░░░░░░░░░░░░░   15%  — Idempotencia del servidor lista
Fase 5 ░░░░░░░░░░░░░░░░░░░░    0%  — Pendiente
Fase 6 ░░░░░░░░░░░░░░░░░░░░    0%  — Pendiente
```

**Lo siguiente:** el resto de la Fase 4 — Service Worker, IndexedDB y la cola de
sincronización, más migrar las vistas operativas a datos en cliente (hoy son Server
Components, así que sin servidor no renderizan).

El deploy está **aplazado a conciencia**, no olvidado: no hay piloto ni demo agendada, y la
arquitectura pone el servidor dentro del establecimiento, no en la nube. El repo queda listo
y el pipeline lo verifica construyendo y arrancando las imágenes en cada push, sin alquilar
infraestructura. Diferidos dentro de Fase 3: envío del recibo por correo y exportación a
PDF/Excel.

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
| **CI/CD** | Tres jobs en GitHub Actions: lint, tipos, 127 tests unitarios y build · 55 tests de integración contra un Postgres real, con las migraciones aplicadas desde cero · construcción de las dos imágenes de Docker, que se arrancan para comprobar salud y assets |

> Pendiente diferido de Fase 2: fusión de mesas para órdenes grupales.
>
> **API documentada** con Swagger en `/api/docs` (92 operaciones). Solo fuera de producción.

---

## Documentación

| Documento | Descripción | Estado |
|-----------|-------------|--------|
| [Visión del Proyecto (RUP)](./docs/LoklFlow_Vision_v1.0.docx) | Alcance, usuarios, requerimientos y riesgos | ✅ Completo |
| [Roadmap de Desarrollo](./docs/ROADMAP.md) | Fases, tareas y entregables del proyecto | ✅ Completo |
| [Modelo de Base de Datos](./docs/DATA_MODEL.md) | 31 tablas, relaciones y decisiones de diseño | ✅ Completo |

> El modelo documenta 31 tablas; hay **25 creadas** (ver `apps/api/src/database/migrations/`).
> Las 6 restantes son de inventario y proveedores, previstas para la Fase 5.

---

## Estructura del Proyecto

```
loklflow/
├── .github/workflows/ci.yml    # verify · integration · images
├── apps/
│   ├── api/                    # Backend NestJS — 92 operaciones
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
│           ├── components/     # incluye ui/ (shadcn) por app
│           ├── hooks/
│           └── lib/
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
pnpm test         # 127 tests unitarios (apps/api y packages/types)

# 55 tests de integración: la app real contra un Postgres real. Usa la base
# loklflow_test, nunca la de desarrollo, y aplica las migraciones desde cero.
docker compose up -d postgres
pnpm --filter=api test:int
```

Los mismos tres pasos, más las imágenes de Docker, corren en GitHub Actions en cada push y
cada PR (`.github/workflows/ci.yml`).

En desarrollo el esquema se sincroniza solo (`synchronize: true` cuando
`NODE_ENV=development`). Fuera de desarrollo el esquema se aplica **solo** con
migraciones — nunca con `synchronize`.

---

## Licencia

MIT © 2026 — LoklFlow