# Modelo de Datos — LoklFlow

Diseño completo de entidades organizadas por módulo. Cada tabla muestra columnas, tipos, restricciones y relaciones.

---

## Índice de módulos

1. [Users & Auth](#1-users--auth)
2. [Menu](#2-menu)
3. [Tables & Sectors](#3-tables--sectors)
4. [Orders](#4-orders)
5. [POS & Payments](#5-pos--payments)
6. [Inventory](#6-inventory)
7. [Sistema & Config](#7-sistema--config)
8. [Diagrama de relaciones](#8-diagrama-de-relaciones)
9. [Resumen de tablas](#9-resumen-de-tablas)

---

## 1. Users & Auth

### `roles`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK, default uuid_generate_v4() | |
| name | varchar(50) | UNIQUE, NOT NULL | Ej. "Administrador", "Mesero", "Cajero" |
| description | varchar(255) | nullable | |
| is_system | boolean | NOT NULL, default false | Protege roles base (no se pueden eliminar) |
| max_discount_percentage | numeric(5,2) | nullable | Límite de descuento sin aprobación. null = sin límite |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

> **Lógica de descuentos:** si el descuento solicitado supera `max_discount_percentage`, el sistema crea el descuento con `status = 'pending'` y dispara notificación al Gerente/Admin. Si el campo es `null`, el rol aprueba sin restricción.

**Relaciones:** `roles` ←→ `permissions` (M:N via `role_permissions`)

---

### `permissions`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| module | varchar(50) | NOT NULL | Ej. `orders`, `menu`, `pos`, `inventory` |
| action | varchar(50) | NOT NULL | Ej. `create`, `read`, `update`, `delete`, `approve_discount` |
| description | varchar(255) | nullable | |

**Índice único:** `(module, action)`

---

### `role_permissions` *(tabla de unión)*
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| role_id | uuid | FK → roles.id, ON DELETE CASCADE |
| permission_id | uuid | FK → permissions.id, ON DELETE CASCADE |

**PK compuesta:** `(role_id, permission_id)`

---

### `users`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(100) | NOT NULL | |
| email | varchar(255) | UNIQUE, nullable | Null para roles operativos (mesero, cocina) |
| password_hash | varchar(255) | nullable | Null si sólo usa PIN |
| pin | varchar(6) | nullable | Login rápido para roles operativos |
| role_id | uuid | FK → roles.id, NOT NULL | |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

> **Regla de negocio:** al menos uno de `email` o `pin` debe estar presente.

---

### `refresh_tokens`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| token | varchar(512) | UNIQUE, NOT NULL | Hash del refresh token |
| user_id | uuid | FK → users.id, ON DELETE CASCADE | |
| expires_at | timestamptz | NOT NULL | |
| is_revoked | boolean | NOT NULL, default false | |
| created_at | timestamptz | NOT NULL, default now() | |

---

## 2. Menu

### `categories`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(100) | NOT NULL | Ej. "Entradas", "Bebidas", "Postres" |
| description | varchar(255) | nullable | |
| image_url | varchar(500) | nullable | |
| sort_order | integer | NOT NULL, default 0 | Orden de aparición en menú |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `products`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(150) | NOT NULL | |
| description | text | nullable | |
| price | numeric(10,2) | NOT NULL, CHECK > 0 | |
| image_url | varchar(500) | nullable | |
| category_id | uuid | FK → categories.id, NOT NULL | |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Relaciones:** `products` ←→ `modifiers` (M:N via `product_modifiers`)

---

### `modifiers`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(100) | NOT NULL | Ej. "Tamaño", "Término", "Extras" |
| is_required | boolean | NOT NULL, default false | |
| allow_multiple | boolean | NOT NULL, default false | |
| min_selections | integer | NOT NULL, default 0 | |
| max_selections | integer | nullable | Null = sin límite |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `modifier_options`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| modifier_id | uuid | FK → modifiers.id, ON DELETE CASCADE | |
| name | varchar(100) | NOT NULL | Ej. "Grande", "Término medio" |
| price_adjustment | numeric(10,2) | NOT NULL, default 0 | Puede ser negativo |
| is_default | boolean | NOT NULL, default false | |
| is_active | boolean | NOT NULL, default true | |
| sort_order | integer | NOT NULL, default 0 | |

---

### `product_modifiers` *(tabla de unión)*
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| product_id | uuid | FK → products.id, ON DELETE CASCADE |
| modifier_id | uuid | FK → modifiers.id, ON DELETE CASCADE |

**PK compuesta:** `(product_id, modifier_id)`

---

### `combos`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(150) | NOT NULL | |
| description | text | nullable | |
| price | numeric(10,2) | NOT NULL, CHECK > 0 | Precio especial del combo |
| image_url | varchar(500) | nullable | |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `combo_items`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| combo_id | uuid | FK → combos.id, ON DELETE CASCADE | |
| product_id | uuid | FK → products.id | |
| quantity | integer | NOT NULL, CHECK > 0, default 1 | |
| allow_substitution | boolean | NOT NULL, default false | El cliente puede cambiar el producto |

---

### `product_availabilities`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| product_id | uuid | FK → products.id, ON DELETE CASCADE | |
| day_of_week | smallint | NOT NULL, CHECK 0-6 | 0=Dom, 1=Lun … 6=Sáb |
| start_time | time | NOT NULL | |
| end_time | time | NOT NULL | |
| is_available | boolean | NOT NULL, default true | |

**Índice:** `(product_id, day_of_week)`

---

## 3. Tables & Sectors

### `sectors`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(100) | NOT NULL | Ej. "Interior", "Terraza", "Barra" |
| description | varchar(255) | nullable | |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `tables`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| number | integer | NOT NULL | Número visible para el personal |
| sector_id | uuid | FK → sectors.id, NOT NULL | |
| capacity | integer | NOT NULL, CHECK > 0 | Comensales máximos |
| status | enum | NOT NULL, default 'available' | `available`, `occupied`, `reserved`, `cleaning`, `maintenance` |
| qr_code | varchar(100) | UNIQUE, NOT NULL | Token único para el menú QR del cliente |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Índice único:** `(sector_id, number)`

---

### `reservations`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| table_id | uuid | FK → tables.id, NOT NULL | |
| customer_name | varchar(150) | NOT NULL | |
| customer_phone | varchar(20) | nullable | |
| party_size | integer | NOT NULL, CHECK > 0 | Número de personas |
| reserved_at | timestamptz | NOT NULL | Fecha y hora de la reserva |
| notes | text | nullable | |
| status | enum | NOT NULL, default 'pending' | `pending`, `confirmed`, `seated`, `cancelled`, `no_show` |
| created_by | uuid | FK → users.id, NOT NULL | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

## 4. Orders

### `orders`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| order_number | integer | UNIQUE, NOT NULL, autoincrement | Número legible (ej. #1042) |
| table_id | uuid | FK → tables.id, nullable | Null = para llevar |
| waiter_id | uuid | FK → users.id, nullable | Null si la orden viene del cliente por QR |
| shift_id | uuid | FK → shifts.id, NOT NULL | |
| source | enum | NOT NULL, default 'staff' | `staff` (mesero) o `customer_qr` (cliente desde QR) |
| status | enum | NOT NULL, default 'pending' | `pending`, `preparing`, `ready`, `delivered`, `closed`, `cancelled` |
| notes | text | nullable | Notas generales de la orden |
| subtotal | numeric(10,2) | NOT NULL, default 0 | Suma de ítems antes de descuentos |
| discount_amount | numeric(10,2) | NOT NULL, default 0 | |
| tip_amount | numeric(10,2) | NOT NULL, default 0 | |
| total | numeric(10,2) | NOT NULL, default 0 | subtotal - discount + tip |
| merged_into_order_id | uuid | FK → orders.id, nullable | Si la mesa fue fusionada, apunta a la orden principal |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

> **Estados:** `pending → preparing → ready → delivered → closed`. El estado `closed` reemplaza a `paid` para reflejar el ciclo completo del doc de visión.

---

### `order_status_history`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| order_id | uuid | FK → orders.id, ON DELETE CASCADE | |
| from_status | enum | nullable | Estado anterior (null si es la creación) |
| to_status | enum | NOT NULL | Estado nuevo |
| changed_by | uuid | FK → users.id, nullable | Null si el cambio es automático del sistema |
| changed_at | timestamptz | NOT NULL, default now() | |
| notes | varchar(255) | nullable | |

> Permite calcular tiempos de servicio: `preparing - pending` = tiempo de espera, `ready - preparing` = tiempo de cocción.

---

### `order_items`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| order_id | uuid | FK → orders.id, ON DELETE CASCADE | |
| product_id | uuid | FK → products.id | |
| quantity | integer | NOT NULL, CHECK > 0 | |
| unit_price | numeric(10,2) | NOT NULL | Snapshot del precio al momento de la orden |
| subtotal | numeric(10,2) | NOT NULL | quantity × unit_price + ajustes de modificadores |
| notes | text | nullable | Ej. "sin cebolla" |
| status | enum | NOT NULL, default 'pending' | `pending`, `preparing`, `ready`, `delivered`, `cancelled` |
| created_at | timestamptz | NOT NULL | |

---

### `order_item_modifiers`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| order_item_id | uuid | FK → order_items.id, ON DELETE CASCADE | |
| modifier_option_id | uuid | FK → modifier_options.id | |
| price_adjustment | numeric(10,2) | NOT NULL | Snapshot del ajuste de precio |

---

## 5. POS & Payments

### `shifts`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| opened_by | uuid | FK → users.id, NOT NULL | |
| closed_by | uuid | FK → users.id, nullable | |
| opened_at | timestamptz | NOT NULL | |
| closed_at | timestamptz | nullable | |
| opening_cash | numeric(10,2) | NOT NULL | Efectivo en caja al abrir turno |
| closing_cash | numeric(10,2) | nullable | Efectivo contado al cierre |
| total_sales | numeric(10,2) | NOT NULL, default 0 | Calculado al cierre |
| status | enum | NOT NULL, default 'open' | `open`, `closed` |
| notes | text | nullable | |

---

### `payments`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| order_id | uuid | FK → orders.id, NOT NULL | |
| method | enum | NOT NULL | `cash`, `card`, `transfer`, `digital_wallet` |
| amount | numeric(10,2) | NOT NULL, CHECK > 0 | |
| reference | varchar(100) | nullable | Referencia de terminal / transferencia |
| processed_by | uuid | FK → users.id, NOT NULL | |
| processed_at | timestamptz | NOT NULL, default now() | |

> Una orden puede tener múltiples pagos (split de cuenta entre comensales).

---

### `discounts`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| order_id | uuid | FK → orders.id, nullable | |
| type | enum | NOT NULL | `percentage`, `fixed` |
| value | numeric(10,2) | NOT NULL, CHECK > 0 | % o monto fijo |
| reason | varchar(255) | NOT NULL | |
| requested_by | uuid | FK → users.id, NOT NULL | |
| approved_by | uuid | FK → users.id, nullable | |
| status | enum | NOT NULL, default 'pending' | `pending`, `approved`, `rejected` |
| approved_at | timestamptz | nullable | |
| created_at | timestamptz | NOT NULL | |

---

### `tips`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| order_id | uuid | FK → orders.id, UNIQUE | Una propina por orden |
| amount | numeric(10,2) | NOT NULL, CHECK > 0 | |
| method | enum | NOT NULL | `cash`, `card`, `digital` |
| created_at | timestamptz | NOT NULL | |

---

## 6. Inventory

### `suppliers`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(150) | NOT NULL | |
| contact_name | varchar(100) | nullable | |
| phone | varchar(20) | nullable | |
| email | varchar(255) | nullable | |
| notes | text | nullable | |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `ingredients`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(150) | NOT NULL, UNIQUE | |
| unit | enum | NOT NULL | `kg`, `g`, `l`, `ml`, `units`, `portions` |
| current_stock | numeric(12,3) | NOT NULL, default 0 | |
| minimum_stock | numeric(12,3) | NOT NULL, default 0 | Umbral de alerta |
| cost_per_unit | numeric(10,4) | NOT NULL, default 0 | Costo promedio de compra |
| is_active | boolean | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `recipe_ingredients`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| product_id | uuid | FK → products.id, ON DELETE CASCADE | |
| ingredient_id | uuid | FK → ingredients.id | |
| quantity | numeric(12,3) | NOT NULL, CHECK > 0 | Cantidad por unidad de producto |

**Índice único:** `(product_id, ingredient_id)`

---

### `stock_movements`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| ingredient_id | uuid | FK → ingredients.id, NOT NULL | |
| type | enum | NOT NULL | `entry`, `consumption`, `waste`, `adjustment` |
| quantity | numeric(12,3) | NOT NULL | Positivo = entrada, negativo = salida |
| previous_stock | numeric(12,3) | NOT NULL | Snapshot antes del movimiento |
| new_stock | numeric(12,3) | NOT NULL | Snapshot después del movimiento |
| reason | varchar(255) | nullable | |
| supplier_id | uuid | FK → suppliers.id, nullable | Solo para movimientos tipo `entry` |
| order_id | uuid | FK → orders.id, nullable | Solo para movimientos tipo `consumption` |
| created_by | uuid | FK → users.id, NOT NULL | |
| created_at | timestamptz | NOT NULL, default now() | |

---

## 7. Sistema & Config

### `business_config`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| name | varchar(150) | NOT NULL | Nombre del establecimiento |
| logo_url | varchar(500) | nullable | |
| address | varchar(255) | nullable | |
| phone | varchar(20) | nullable | |
| email | varchar(255) | nullable | |
| timezone | varchar(50) | NOT NULL, default 'America/Bogota' | |
| opening_time | time | nullable | Hora de apertura del local |
| closing_time | time | nullable | Hora de cierre del local |
| printer_config | jsonb | nullable | Config de impresora ESC/POS (IP, puerto, modelo) |
| updated_by | uuid | FK → users.id, nullable | |
| updated_at | timestamptz | NOT NULL, default now() | |

> Tabla con una sola fila. Se usa `printer_config` como JSONB para flexibilidad sin necesidad de normalizar la config de impresora.

---

### `notifications`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| user_id | uuid | FK → users.id, ON DELETE CASCADE | Destinatario |
| type | enum | NOT NULL | `order_ready`, `order_new`, `discount_pending`, `stock_alert`, `table_ready_to_pay` |
| title | varchar(150) | NOT NULL | |
| body | varchar(500) | nullable | |
| resource_type | varchar(50) | nullable | Ej. `order`, `discount`, `ingredient` |
| resource_id | uuid | nullable | ID del recurso relacionado |
| is_read | boolean | NOT NULL, default false | |
| created_at | timestamptz | NOT NULL, default now() | |

> WebSocket entrega la notificación en tiempo real. La tabla persiste el historial y permite marcar como leída.

---

### `audit_logs`
| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | uuid | PK | |
| user_id | uuid | FK → users.id, nullable | Null si es acción del sistema |
| action | varchar(100) | NOT NULL | Ej. `order.create`, `payment.process`, `discount.approve` |
| resource_type | varchar(50) | NOT NULL | Ej. `order`, `user`, `product` |
| resource_id | uuid | nullable | ID del recurso afectado |
| previous_data | jsonb | nullable | Estado anterior (para updates y deletes) |
| new_data | jsonb | nullable | Estado nuevo |
| ip_address | varchar(45) | nullable | IPv4 o IPv6 |
| created_at | timestamptz | NOT NULL, default now() | |

> Append-only. Nunca se actualiza ni se elimina un registro de auditoría.

---

## 8. Diagrama de relaciones

```
┌──────────────────────────────────────────────────────────────┐
│  AUTH                                                        │
│                                                              │
│  roles ──M:N── permissions    users ──1:M── refresh_tokens  │
│    │           (via role_permissions)  │                     │
│    └───────────────────────────────────┘                     │
│               users.role_id → roles.id                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  MENU                                                        │
│                                                              │
│  categories ──1:M── products ──M:N── modifiers              │
│                         │           (via product_modifiers)  │
│                         │                    │               │
│                         │           modifier_options         │
│                         │                                    │
│                    product_availabilities                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  TABLES                                                      │
│                                                              │
│  sectors ──1:M── tables ──1:M── reservations                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  ORDERS                                                      │
│                                                              │
│  orders ──1:M── order_status_history                        │
│    │                                                         │
│    └──1:M── order_items ──1:M── order_item_modifiers        │
│    │                                                         │
│    ├──1:M── payments                                         │
│    ├──1:M── discounts                                        │
│    └──1:1── tips                                             │
│                                                              │
│  orders.merged_into_order_id → orders.id (self-ref)         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  INVENTORY                                                   │
│                                                              │
│  suppliers ──1:M── stock_movements                          │
│                          │                                   │
│  ingredients ──1:M───────┘                                   │
│       │                                                      │
│       └──M:1── recipe_ingredients ──M:1── products          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  SISTEMA                                                     │
│                                                              │
│  business_config (1 fila)                                   │
│  notifications  (por usuario)                               │
│  audit_logs     (append-only)                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Resumen de tablas

| # | Tabla | Módulo |
|---|-------|--------|
| 1 | `roles` | Auth |
| 2 | `permissions` | Auth |
| 3 | `role_permissions` | Auth |
| 4 | `users` | Auth |
| 5 | `refresh_tokens` | Auth |
| 6 | `categories` | Menu |
| 7 | `products` | Menu |
| 8 | `modifiers` | Menu |
| 9 | `modifier_options` | Menu |
| 10 | `product_modifiers` | Menu |
| 11 | `combos` | Menu |
| 12 | `combo_items` | Menu |
| 13 | `product_availabilities` | Menu |
| 14 | `sectors` | Tables |
| 15 | `tables` | Tables |
| 16 | `reservations` | Tables |
| 17 | `orders` | Orders |
| 18 | `order_status_history` | Orders |
| 19 | `order_items` | Orders |
| 20 | `order_item_modifiers` | Orders |
| 21 | `shifts` | POS |
| 22 | `payments` | POS |
| 23 | `discounts` | POS |
| 24 | `tips` | POS |
| 25 | `suppliers` | Inventory |
| 26 | `ingredients` | Inventory |
| 27 | `recipe_ingredients` | Inventory |
| 28 | `stock_movements` | Inventory |
| 29 | `business_config` | Sistema |
| 30 | `notifications` | Sistema |
| 31 | `audit_logs` | Sistema |

**Total: 31 tablas**
