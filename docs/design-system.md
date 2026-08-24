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
  - **Admin (escritorio y tableta, `≥sm`)**: controles `size="default"`/`"lg"` (h-8/h-9). Densidad cómoda, exactamente igual que siempre.
  - **Admin (móvil, `<sm`)**: el panel lo abre a diario el dueño desde el teléfono, así que por debajo de 640 px los controles suben al suelo táctil. **No se hace pantalla por pantalla**: se hace una vez en `ui/button.tsx`, `ui/input.tsx`, `ui/select.tsx` y `ui/dropdown-menu.tsx` con la variante `max-sm:` — `default` es `h-8 max-sm:h-11`, `sm` es `h-7 max-sm:h-10`, `icon-sm` es `size-7 max-sm:size-10`.
  - **POS / KDS / mesero (táctil)**: objetivos ≥44px con `size="touch"` (`h-11`) e `size="icon-touch"` (`size-11`), que son 44px exactos en la escala de Tailwind. Los usa todo `components/{pos,kitchen,waiter}`; no queda ahí un solo `Button size="sm"`. Son los dos únicos tamaños **sin** variante `max-sm:`: miden 44 px a cualquier ancho porque marcan lo que se pulsa de pie.

#### La forma de la clase importa, y no es una preferencia de estilo

> Toda clase nueva se escribe **`valor-de-hoy max-sm:valor-móvil`**. Si en un diff aparece un valor
> sin prefijo que hoy no estaba, se ha cambiado el escritorio.

`cn(buttonVariants({ size, className }))` pasa por `tailwind-merge`, que **no** ve conflicto entre
`h-12` y `sm:h-8` —son modificadores distintos— pero sí entre `h-12` y `h-8`. Con la forma
`h-11 sm:h-8`, un `className="h-12"` del sitio de llamada dejaría `h-12 sm:h-8` y el botón encogería
a **32 px en escritorio**, que es el modo de romper el panel sin que se note. Con el valor de
escritorio sin prefijo, un `className` lo pisa igual que siempre. `button.spec.tsx` lo afirma.

Y el breakpoint es **`sm` (640 px), uno solo, no `md`**: un iPad mini en vertical mide 744 px, así que
anclar en `md` habría reflujado una tableta. Con `sm`, todo lo que mide ≥640 px queda como estaba.

Los controles deliberadamente más altos que el suelo táctil —el teclado del PIN, los CTA de la carta
pública— llevan su propio `max-sm:h-14` / `max-sm:h-12`: si no, la variante los aplastaría a 44 px.

### Tablas en móvil — decisión aceptada

Quince componentes usan `ui/table`, que envuelve en `overflow-x-auto`: **no se rompen**, se
desplazan dentro de su propio contenedor. Solo dos tienen versión de tarjeta-por-fila —el listado
de órdenes de `/admin/orders`— porque son las que un dueño abre desde el teléfono.

Las otras trece siguen desplazándose, y es deliberado: quince renderizados duales son una semana
de trabajo para pantallas que se usan en portátil. Lo que sí se comprueba en cada ejecución es
que **la página no se desborde a lo ancho** (`e2e/responsive.spec.ts`, proyecto `movil`), que es
la diferencia entre «esta tabla se desplaza» y «esta pantalla está rota».

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
- [ ] Probado a 390 px: toda fila de campos apila con `sm:flex-row`, y ningún diálogo deja su botón de guardar fuera de la pantalla con el teclado abierto.
- [ ] Ninguna clase nueva cambia el escritorio: el valor sin prefijo es el de hoy (§4).
- [ ] Verifica claro y oscuro antes de mergear.
