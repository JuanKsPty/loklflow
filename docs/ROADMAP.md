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
- [x] Log de auditoría de acciones críticas (`audit_logs`) — 15 acciones registradas
      (accesos, empleados, roles y permisos, caja, cancelaciones) con valor anterior y
      posterior, redacción de credenciales, filtros y vista en `/admin/audit`
- [x] Esquema versionado con migraciones TypeORM (`synchronize` solo en desarrollo)
- [x] ESLint 10 con flat config compartida, `typecheck` y primeros tests en verde
- [x] Pipeline CI/CD con GitHub Actions — tres jobs: `verify` (lint, tipos, 127 tests y
      build), `integration` (55 tests contra un Postgres real, con las migraciones aplicadas
      desde cero) e `images` (construye las dos imágenes, aplica migraciones y seed desde la
      imagen, y las arranca para comprobar `/api/health` y los assets)
- [x] Imágenes de Docker de las dos apps, listas para desplegar
- [ ] Deploy en producción _(aplazado a propósito: no hay piloto ni demo agendada, y la
      arquitectura del producto pone el servidor dentro del establecimiento, no en la nube.
      El repo queda listo y CI lo verifica sin alquilar nada)_

**Entregable:** Sistema de auth con RBAC verificado automáticamente y empaquetado.

---

## Fase 2 — Core del Negocio
> Un mesero toma una orden y cocina la ve en tiempo real.

- [x] Módulo de menú (categorías, productos, modificadores, combos)
- [x] Disponibilidad de productos por horario
- [x] Módulo de mesas y sectores (mapa visual)
- [x] Estados de mesa en tiempo real (`available`, `occupied`, `reserved`, `cleaning`, `maintenance`)
- [ ] Fusión de mesas para órdenes grupales _(diferida — columna `merged_into_order_id` ya existe)_
- [x] Gestión de reservas de mesa
- [x] Módulo de órdenes completo
- [x] Historial de transiciones de estado (`order_status_history`) para métricas de tiempo
- [x] WebSockets — cocina recibe órdenes al instante
- [x] Vista de mesero (tomar orden desde móvil)
- [x] Vista KDS de cocina (pantalla dedicada)
- [x] Flujo de estados de orden (pendiente → en preparación → lista → entregada → cerrada)
- [x] Notificaciones en tiempo real entre roles (WebSocket + persistencia en BD)

**Entregable:** Flujo completo de orden desde mesero hasta cocina en tiempo real.

---

## Fase 3 — Caja y Reportes
> El cajero cobra y el dueño ve qué pasó en el día.

- [x] Módulo de POS y cobro (cierre de cuenta + liberación de mesa)
- [x] Múltiples métodos de pago (efectivo, tarjeta, transferencia, billetera)
- [x] Split de cuenta entre comensales (pagos parciales por método)
- [x] Descuentos con flujo de aprobación por rol — umbral por rol, solicitud/aprobación
      con notificación al gerente, bandeja en `/admin/approvals` y auditoría completa
- [x] Propina digital
- [x] Impresión de recibo — vista de 80 mm en `/recibo/[id]` con datos fiscales del
      negocio e IVA desglosado del precio; impresión con `window.print()`
      _(el envío por correo queda para Fase 6)_
- [x] Apertura y cierre de turno
- [x] Resumen automático del turno
- [x] Dashboard de métricas en tiempo real — ventas, ticket promedio, cuentas abiertas,
      tiempos de preparación, top de productos y reparto por método de pago
- [x] Reportes históricos exportables — CSV de ventas por rango
      _(PDF y Excel diferidos)_
- [x] Documentación Swagger en `/api/docs` (92 operaciones)

**Entregable:** POS funcional con cierre de turno y dashboard para el dueño. ✅

---

## Fase 4 — Offline y Resiliencia
> El sistema funciona aunque se caiga el WiFi.

- [x] Idempotencia en el servidor, hecha antes que la cola porque retrofitarla después
      significaría reescribir la cola: `POST /orders` y sus ítems aceptan el uuid que genera
      el dispositivo como clave primaria, y `POST /orders/:id/payments` acepta
      `clientRequestId`. Reenviar una operación devuelve el estado en lugar de duplicarla
- [x] `order_number` por secuencia de Postgres, en lugar de un `MAX+1` que con dos meseros
      simultáneos devolvía 500 y perdía la orden
- [x] Service Worker registrado y funcional — `public/sw.js`, escrito a mano. Filtra por
      **path** y no por origen, porque en producción la API vive detrás del mismo dominio y el
      filtro por origen no filtraría nada. Sin `skipWaiting`: cambiar los chunks bajo una tablet
      en pleno servicio parece una caída
- [x] Persistencia de operaciones en IndexedDB — sobre Dexie, con el orden asignado por la base
      (`++seq`): calcularlo en el cliente deja una carrera entre pestañas que puede mandar
      «añadir ítem» antes que «crear la comanda»
- [x] Cola de sincronización ordenada por timestamp — por `seq`, que es estrictamente mejor:
      `Date.now()` tiene resolución de milisegundo y un mesero que toca rápido encola varias
      operaciones dentro del mismo
- [x] Migrar las vistas operativas (`/waiter`, `/kitchen`, `/pos`) a datos en cliente — las ocho
      rutas pasan a cascarón de servidor + vista de cliente sobre la copia local, con el catálogo
      guardado (sin él se podría cambiar lo que ya existe pero no tomar una comanda nueva)
- [x] Detección automática de pérdida de conexión — tres detectores: el resultado de las
      peticiones reales, la sonda a `/api/health` (no a `/ready`, que consulta la base) y el
      `false` de `navigator.onLine`, que es lo único fiable que dice
- [x] Activación del modo offline sin intervención del usuario — no hay interruptor: la cola se
      llena cuando el `fetch` rechaza y se vacía cuando vuelve el camino, con 15 s de peor caso
- [x] Resolución de conflictos en sincronización — el diseño los evita en lugar de resolverlos
      (nada diferible lleva un valor que dos dispositivos puedan editar). El único alcanzable es
      el estado de mesa, que desempata por hora del hecho contra `tables.status_changed_at`
- [x] Indicador de estado online/offline en todas las vistas — en las tres cabeceras operativas,
      **siempre visible**: uno que solo aparece con problemas enseña a no mirar ese rincón. Con
      bandeja de fallos y marca por cuenta
- [x] Pruebas de sincronización (corte y reconexión simulados) — 6 pruebas de Playwright sobre el
      build de producción, incluida una recarga estando sin red (la persistencia tiene que
      sobrevivir al cierre de la pestaña, no solo al render)
- [x] Documentación del proceso de sync — `docs/OFFLINE.md`, con los límites conocidos escritos
      como decisiones

**Entregable:** Sistema que opera sin internet y sincroniza sin pérdida de datos. ✅

---

## Fase 5 — Inventario y Menú QR
> El negocio controla su stock y los clientes ordenan solos.

- [x] Catálogo de ingredientes con stock y unidades
- [x] Gestión de proveedores (`suppliers`)
- [x] Recetas vinculadas a productos del menú
- [x] Descuento automático de inventario al cerrar órdenes — por los **dos** caminos de cierre
      (`updateStatus` y `closeFromPayment`), idempotente por índice parcial único
- [x] Alertas de stock mínimo — solo al cruzar el umbral, no en cada movimiento
- [x] Registro de entradas de mercancía (con proveedor y costo) — actualiza el costo promedio
- [x] Registro de merma
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
- [x] Documentación Swagger completa y publicada _(hecho en Fase 3)_
- [ ] README con screenshots y GIFs del sistema
- [ ] Video demo de 2-3 minutos
- [ ] Auditoría de seguridad básica (OWASP top 10)
- [ ] Optimización de performance (Lighthouse)

**Entregable:** Proyecto completo, documentado y presentable para portafolio.
