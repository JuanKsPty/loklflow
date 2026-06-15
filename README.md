<div align="center">

# LoklFlow

**Sistema Integral de Gestión para Establecimientos F&B**

*Restaurantes · Bares · Cafeterías*

![Status](https://img.shields.io/badge/estado-en%20desarrollo-yellow?style=flat-square)
![License](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)
![Phase](https://img.shields.io/badge/fase%20actual-2%20%E2%80%94%20Core%20del%20Negocio-blue?style=flat-square)
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
| **Infra** | Docker · GitHub Actions · Railway/AWS |
| **Documentación** | Swagger / OpenAPI |

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
Fase 1 ████████████████████ 100%  — Completada (deploy/CI diferidos)
Fase 2 ███████████████████░   95%  — Casi lista (solo fusión de mesas, diferida)
Fase 3 █████████░░░░░░░░░░░░   45%  — En progreso (cobro/POS y turnos de caja hechos; faltan descuentos y reportes)
Fase 4 ░░░░░░░░░░░░░░░░░░░░    0%  — Pendiente
Fase 5 ░░░░░░░░░░░░░░░░░░░░    0%  — Pendiente
Fase 6 ░░░░░░░░░░░░░░░░░░░░    0%  — Pendiente
```

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

> Pendiente diferido de Fase 2: fusión de mesas para órdenes grupales.

---

## Documentación

| Documento | Descripción | Estado |
|-----------|-------------|--------|
| [Visión del Proyecto (RUP)](./docs/LoklFlow_Vision_v1.0.docx) | Alcance, usuarios, requerimientos y riesgos | ✅ Completo |
| [Roadmap de Desarrollo](./docs/ROADMAP.md) | Fases, tareas y entregables del proyecto | ✅ Completo |
| [Modelo de Base de Datos](./docs/DATA_MODEL.md) | 31 tablas, relaciones y decisiones de diseño | ✅ Completo |

| Arquitectura de Infraestructura | Setup local + nube + offline | ✅ Completo |

---

## Estructura del Proyecto

```
loklflow/
├── apps/
│   ├── api/               # Backend NestJS
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── menu/
│   │   │   ├── tables/
│   │   │   ├── orders/
│   │   │   ├── pos/
│   │   │   ├── inventory/
│   │   │   ├── reports/
│   │   │   └── websockets/
│   │   └── test/
│   └── web/               # Frontend Next.js
│       ├── app/
│       │   ├── (admin)/   # Panel de administración
│       │   ├── (pos)/     # Vista del cajero
│       │   ├── (waiter)/  # Vista del mesero
│       │   ├── (kitchen)/ # KDS de cocina
│       │   └── menu/      # Menú público QR
│       └── public/
├── packages/
│   ├── ui/                # Componentes compartidos
│   ├── types/             # Tipos TypeScript compartidos
│   └── config/            # ESLint, TSConfig base
├── docs/                  # Documentación técnica
├── turbo.json
├── docker-compose.yml
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

# Levantar servicios con Docker
docker-compose up -d

# Instalar dependencias (pnpm gestiona el monorepo con Turborepo)
pnpm install

# Correr todos los servicios en desarrollo
pnpm dev

# Correr solo un app específico
pnpm dev --filter=api
pnpm dev --filter=web
```

---

## Licencia

MIT © 2026 — LoklFlow