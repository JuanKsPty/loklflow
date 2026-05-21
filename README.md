<div align="center">

# LoklFlow

**Sistema Integral de Gestión para Establecimientos F&B**

*Restaurantes · Bares · Cafeterías*

![Status](https://img.shields.io/badge/estado-en%20desarrollo-yellow?style=flat-square)
![License](https://img.shields.io/badge/licencia-MIT-blue?style=flat-square)
![Phase](https://img.shields.io/badge/fase%20actual-0%20%E2%80%94%20Fundaci%C3%B3n-orange?style=flat-square)
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
Fase 0 ████░░░░░░░░░░░░░░░░  20%  — En progreso
Fase 1 ░░░░░░░░░░░░░░░░░░░░   0%  — Pendiente
Fase 2 ░░░░░░░░░░░░░░░░░░░░   0%  — Pendiente
Fase 3 ░░░░░░░░░░░░░░░░░░░░   0%  — Pendiente
Fase 4 ░░░░░░░░░░░░░░░░░░░░   0%  — Pendiente
Fase 5 ░░░░░░░░░░░░░░░░░░░░   0%  — Pendiente
Fase 6 ░░░░░░░░░░░░░░░░░░░░   0%  — Pendiente
```

---

## Documentación

| Documento | Descripción | Estado |
|-----------|-------------|--------|
| [Visión del Proyecto (RUP)](./docs/LoklFlow_Vision_v1.0.docx) | Alcance, usuarios, requerimientos y riesgos | ✅ Completo |
| [Roadmap de Desarrollo](./docs/ROADMAP.md) | Fases, tareas y entregables del proyecto | ✅ Completo |
| Modelo de Base de Datos | Diagrama ER y esquema completo | 🔄 En progreso |
| Diseño de API | Endpoints documentados en Swagger | ⏳ Pendiente |
| Wireframes | Vistas principales del sistema | ⏳ Pendiente |
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

> ⚠️ Instrucciones disponibles a partir de la Fase 1.

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