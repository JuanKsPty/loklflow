# Sistema de diseño — LoklFlow

Guía de referencia (las "lineaturas") para construir cualquier pantalla de LoklFlow. Toda UI nueva debe seguir estos patrones para mantener una experiencia coherente entre el panel admin y las futuras superficies operativas (POS, cocina/KDS, mesero móvil, menú QR).

Base técnica: **Next.js 15 (App Router) + Tailwind v4 + shadcn (estilo `base-nova` sobre `@base-ui/react`)**. Componentes en [`apps/web/src/components/ui/`](../apps/web/src/components/ui/).

---

## 1. Filosofía

- **Base neutra + un único acento.** El color de marca es un índigo (`--primary`); todo lo demás es neutro. El color comunica acción y estado, no decora.
- **Claridad operativa.** En un restaurante se lee de un vistazo: jerarquía clara, estados con color semántico, números legibles (fuente mono tabular para dinero).
- **Tokens, siempre.** Nunca colores crudos de Tailwind (`bg-gray-50`, `text-blue-600`, `bg-green-100`). Se consumen exclusivamente los tokens semánticos de abajo. Esto garantiza dark mode y rebrand sin tocar componentes.
- **Listo para táctil.** El admin usa densidad cómoda; las superficies táctiles futuras suben los objetivos a ≥44px reutilizando los mismos tokens.

## 2. Tokens de color

Definidos en [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css) como variables CSS en OKLCH, mapeadas a utilidades Tailwind en el bloque `@theme inline`. Hay variante clara (`:root`) y oscura (`.dark`).

| Token | Utilidad | Uso |
|---|---|---|
| `background` / `foreground` | `bg-background` `text-foreground` | Lienzo y texto base |
| `card` / `card-foreground` | `bg-card` | Superficies elevadas (tarjetas, tablas) |
| `popover` / `popover-foreground` | `bg-popover` | Menús, dropdowns, toasts |
| `primary` / `primary-foreground` | `bg-primary` `text-primary` | **Acento de marca** — acciones primarias, enlaces, estado activo |
| `secondary` | `bg-secondary` | Acciones secundarias |
| `muted` / `muted-foreground` | `bg-muted` `text-muted-foreground` | Fondos sutiles, texto auxiliar |
| `accent` | `bg-accent` | Hover/selección en menús |
| `border` / `input` / `ring` | `border` `ring-ring` | Bordes, inputs, anillo de foco (acento) |

### Estados de dominio (F&B)

Para órdenes, mesas y KDS. Úsalos como `bg-<token>/10 text-<token> border-<token>/30` en badges, o sólidos para énfasis.

| Token | Significado canónico |
|---|---|
| `success` | Listo / activo / pagado / disponible |
| `warning` | En preparación / pendiente / atención |
| `info` | Informativo / en curso |
| `destructive` | Error / cancelado / acción peligrosa |

Ejemplo de badge de estado (patrón usado en [`user-table.tsx`](../apps/web/src/components/admin/user-table.tsx)):

```tsx
<Badge variant="outline" className="border-success/30 bg-success/10 text-success">Activo</Badge>
```

### Charts

`chart-1..5` derivan del acento + hues de apoyo (verde, ámbar, azul, púrpura) para visualizaciones de reportes.

## 3. Tipografía

- **Geist** (`--font-sans` / `font-sans`): UI general. `--font-heading` apunta a la misma familia; usa `font-heading` en títulos para futura divergencia.
- **Geist Mono** (`--font-mono` / `font-mono`): **dinero, cantidades, PINs y totales**. Combínala con `tabular-nums` para que las cifras no "bailen". Crítico en POS y tablas numéricas.

```tsx
<span className="font-mono tabular-nums">$240.00</span>
```

Escala: títulos de página `text-xl font-semibold tracking-tight`; secciones `text-sm font-medium`; cuerpo `text-sm`; auxiliar `text-xs text-muted-foreground`.

## 4. Radio, espaciado y densidad

- **Radio**: `--radius: 0.625rem` con escala derivada (`rounded-md`, `rounded-lg`, `rounded-xl`). Tarjetas y contenedores: `rounded-xl`.
- **Espaciado**: escala Tailwind estándar. Padding de página `p-4 md:p-6`; gap entre campos `gap-5`; secciones `space-y-6`.
- **Densidad por superficie**:
  - **Admin (escritorio)**: controles `size="default"`/`"lg"` (h-8/h-9). Densidad cómoda.
  - **POS / KDS / mesero (táctil)**: objetivos ≥44px. Usa `size="lg"` + alturas explícitas (`h-14`) como en el [`PinPad`](../apps/web/src/components/auth/pin-pad.tsx). Cuando se aborden esas fases, añadir un tamaño `touch` a `buttonVariants`.

## 5. Dark mode

- Provisto por `next-themes` vía [`ThemeProvider`](../apps/web/src/components/theme-provider.tsx) (montado en el root layout, `attribute="class"`, `defaultTheme="system"`).
- Selector en [`ThemeToggle`](../apps/web/src/components/theme-toggle.tsx) (claro/oscuro/sistema), presente en el header del dashboard.
- Como todo usa tokens, **no se escribe CSS específico de tema** en las pantallas: el cambio es automático. El KDS (cocina) se beneficia del tema oscuro.

## 6. Componentes disponibles

Instalados en `components/ui/`. Notas propias de `base-nova`/base-ui:

- **Polimorfismo con `render`, no `asChild`.** Para que un botón/enlace/menú renderice otro elemento se usa la prop `render`:
  ```tsx
  // Un Button que renderiza un <a> (Link) NO es un <button> nativo:
  // añade nativeButton={false} para no romper las semánticas de base-ui.
  <Button nativeButton={false} render={<Link href="/admin/users/new" />}>Nuevo</Button>
  <SidebarMenuButton isActive render={<Link href={href} />}>…</SidebarMenuButton>
  ```
- **Formularios**: no hay `Form` de Radix; se usa `Field` (`FieldLabel`, `FieldError`, `FieldDescription`, `FieldGroup`) integrado con **react-hook-form + Zod**.

| Categoría | Componentes |
|---|---|
| Layout/navegación | `sidebar`, `breadcrumb`, `separator`, `tabs`, `sheet` |
| Datos | `table`, `badge`, `avatar`, `skeleton`, `empty` |
| Formularios | `field`, `input`, `label`, `select`, `checkbox`, `switch`, `input-otp` |
| Acciones/overlays | `button`, `dropdown-menu`, `dialog`, `alert-dialog`, `tooltip` |
| Feedback | `sonner` (toasts), `spinner`, `alert` |

## 7. Patrones canónicos

### Shell de aplicación
[`(dashboard)/layout.tsx`](../apps/web/src/app/(dashboard)/layout.tsx) → `SidebarProvider` + [`AppSidebar`](../apps/web/src/components/app-sidebar.tsx) + `SidebarInset` con [`AppHeader`](../apps/web/src/components/app-header.tsx). La navegación se **filtra por permisos** del `JwtPayload` (RBAC del backend); el footer del sidebar tiene el menú de usuario con logout.

### Página de listado
Encabezado + acción + tabla, con estado vacío. Patrón en [`admin/users/page.tsx`](../apps/web/src/app/(dashboard)/admin/users/page.tsx):

```tsx
<PageHeader title="Empleados" description="…" action={<Button render={<Link href="…"/>}><PlusIcon/>Nuevo</Button>} />
<Table>…</Table>      // o <Empty> si no hay datos
```

Usa [`PageHeader`](../apps/web/src/components/page-header.tsx) para todo encabezado de página. Para carga, `Skeleton`; para vacío, `Empty`.

### Formulario
`Card` (en auth) o ancho acotado (`max-w-lg`) + `FieldGroup`/`Field` + `Button` con `Spinner` + `toast` de éxito/error. Patrón en [`user-form.tsx`](../apps/web/src/components/admin/user-form.tsx). **Los errores y confirmaciones van por `toast` (sonner), no por bloques inline.**

### Estados de dominio
Badge con token semántico (ver §2). Mapa de referencia para órdenes:

| Estado | Token |
|---|---|
| Nueva / en curso | `info` |
| En preparación | `warning` |
| Listo / entregado | `success` |
| Cancelada | `destructive` |

## 8. Reglas rápidas (checklist de PR)

- [ ] Cero colores crudos: nada de `gray-*`, `blue-*`, `green-*`, `bg-white`. Solo tokens.
- [ ] Enlaces-como-botón con `render={<Link/>}` + `nativeButton={false}`, no `<a className={buttonVariants()}>`.
- [ ] Formularios con `Field` + react-hook-form + Zod; feedback con `toast`.
- [ ] Dinero/cantidades con `font-mono tabular-nums`.
- [ ] Encabezados con `PageHeader`; vacíos con `Empty`; carga con `Skeleton`.
- [ ] Navegación nueva del admin filtrada por permiso en [`app-sidebar.tsx`](../apps/web/src/components/app-sidebar.tsx).
- [ ] Verifica claro y oscuro antes de mergear.
