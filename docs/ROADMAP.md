# Roadmap de Desarrollo — LoklFlow

El proyecto se construye en 6 fases. Cada fase tiene un entregable funcional que puede demostrarse de manera independiente.

---

## Fase 0 — Fundación
> Toda la arquitectura y documentación antes de escribir código de negocio.

- [x] Documento de Visión (RUP)
- [x] Definición de alcance y módulos
- [x] Arquitectura de infraestructura (local + nube + offline)
- [x] Modelo de base de datos (31 tablas — `docs/DATA_MODEL.md`)
- [x] README profesional con arquitectura
- [x] Setup del repositorio y estructura de carpetas
- [x] Docker Compose base (NestJS + PostgreSQL + Redis)

---

## Fase 1 — Columna Vertebral
> El sistema existe, corre y controla quién accede a qué.

- [x] Módulo de autenticación (JWT + refresh tokens)
- [x] Login rápido por PIN para roles operativos
- [x] Módulo de roles y permisos (RBAC granular)
- [x] Creación y gestión de roles personalizados (con umbral de descuento por rol)
- [x] CRUD de empleados
- [x] Panel de administración (login + gestión de usuarios)
- [x] Guards y decoradores de permisos por módulo
- [x] Configuración general del negocio (`business_config`)
- [x] Log de auditoría de acciones críticas (`audit_logs`)
- [ ] Deploy en producción (Railway / Render)
- [ ] Pipeline CI/CD básico con GitHub Actions

**Entregable:** Sistema de auth con RBAC funcionando en producción.

---

## Fase 2 — Core del Negocio
> Un mesero toma una orden y cocina la ve en tiempo real.

- [x] Módulo de menú (categorías, productos, modificadores, combos)
- [x] Disponibilidad de productos por horario
- [x] Módulo de mesas y sectores (mapa visual)
- [x] Estados de mesa en tiempo real (`available`, `occupied`, `reserved`, `cleaning`, `maintenance`)
- [ ] Fusión de mesas para órdenes grupales
- [x] Gestión de reservas de mesa
- [x] Módulo de órdenes completo
- [x] Historial de transiciones de estado (`order_status_history`) para métricas de tiempo
- [x] WebSockets — cocina recibe órdenes al instante
- [x] Vista de mesero (tomar orden desde móvil)
- [x] Vista KDS de cocina (pantalla dedicada)
- [x] Flujo de estados de orden (pendiente → en preparación → lista → entregada → cerrada)
- [ ] Notificaciones en tiempo real entre roles (WebSocket + persistencia en BD)

**Entregable:** Flujo completo de orden desde mesero hasta cocina en tiempo real.

---

## Fase 3 — Caja y Reportes
> El cajero cobra y el dueño ve qué pasó en el día.

- [ ] Módulo de POS y cobro
- [ ] Múltiples métodos de pago (efectivo, tarjeta, transferencia)
- [ ] Split de cuenta entre comensales
- [ ] Descuentos con flujo de aprobación por rol
- [ ] Propina digital
- [ ] Impresión / envío de recibo
- [ ] Apertura y cierre de turno
- [ ] Resumen automático del turno
- [ ] Dashboard de métricas en tiempo real
- [ ] Reportes históricos exportables (PDF / Excel)

**Entregable:** POS funcional con cierre de turno y dashboard para el dueño.

---

## Fase 4 — Offline y Resiliencia
> El sistema funciona aunque se caiga el WiFi.

- [ ] Service Worker registrado y funcional
- [ ] Persistencia de operaciones en IndexedDB
- [ ] Cola de sincronización ordenada por timestamp
- [ ] Detección automática de pérdida de conexión
- [ ] Activación del modo offline sin intervención del usuario
- [ ] Resolución de conflictos en sincronización
- [ ] Indicador de estado online/offline en todas las vistas
- [ ] Pruebas de sincronización (corte y reconexión simulados)
- [ ] Documentación del proceso de sync

**Entregable:** Sistema que opera sin internet y sincroniza sin pérdida de datos.

---

## Fase 5 — Inventario y Menú QR
> El negocio controla su stock y los clientes ordenan solos.

- [ ] Catálogo de ingredientes con stock y unidades
- [ ] Gestión de proveedores (`suppliers`)
- [ ] Recetas vinculadas a productos del menú
- [ ] Descuento automático de inventario al cerrar órdenes
- [ ] Alertas de stock mínimo
- [ ] Registro de entradas de mercancía (con proveedor y costo)
- [ ] Registro de merma
- [ ] Código QR único por mesa
- [ ] Vista pública del menú (sin autenticación)
- [ ] Flujo de orden completa desde QR del cliente (`source: customer_qr`)

**Entregable:** Inventario automatizado y flujo completo de cliente con QR.

---

## Fase 6 — Pulido Final
> De proyecto a producto.

- [ ] UI/UX consistente en todas las vistas
- [ ] Diseño responsive para todos los dispositivos
- [ ] Pruebas unitarias (mínimo 70% de cobertura en servicios)
- [ ] Pruebas e2e de los flujos principales
- [ ] Documentación Swagger completa y publicada
- [ ] README con screenshots y GIFs del sistema
- [ ] Video demo de 2-3 minutos
- [ ] Auditoría de seguridad básica (OWASP top 10)
- [ ] Optimización de performance (Lighthouse)

**Entregable:** Proyecto completo, documentado y presentable para portafolio.
