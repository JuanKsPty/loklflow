import {
  LayoutDashboardIcon,
  LayoutGridIcon,
  PackageIcon,
  PercentIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
  UtensilsCrossedIcon,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: typeof UsersIcon;
  permission: string;
  /**
   * Orden en la barra inferior del teléfono. Sin valor, el destino solo aparece en el cajón.
   *
   * Caben cuatro: el quinto hueco es siempre «Más», que abre el cajón con el resto.
   */
  bar?: number;
}

/**
 * Los destinos del panel, en un archivo sin `'use client'` para que los compartan el cajón lateral
 * y la barra inferior.
 *
 * Vivían dentro de `app-sidebar.tsx`. Sacarlos no es orden por el orden: dos listas de navegación
 * derivando es exactamente cómo la barra acaba enseñando un enlace que devuelve 403.
 */
export const NAV_ITEMS: NavItem[] = [
  { title: 'Panel', href: '/admin', icon: LayoutDashboardIcon, permission: 'pos:read', bar: 1 },
  { title: 'Inventario', href: '/admin/inventario', icon: PackageIcon, permission: 'inventory:read', bar: 2 },
  { title: 'Órdenes', href: '/admin/orders', icon: ReceiptTextIcon, permission: 'orders:read', bar: 3 },
  { title: 'Menú', href: '/admin/menu', icon: UtensilsCrossedIcon, permission: 'menu:read', bar: 4 },
  { title: 'Mesas', href: '/admin/tables', icon: LayoutGridIcon, permission: 'tables:read' },
  { title: 'Empleados', href: '/admin/users', icon: UsersIcon, permission: 'users:read' },
  { title: 'Roles', href: '/admin/roles', icon: ShieldIcon, permission: 'roles:read' },
  { title: 'Aprobaciones', href: '/admin/approvals', icon: PercentIcon, permission: 'pos:approve_discount' },
  { title: 'Auditoría', href: '/admin/audit', icon: ScrollTextIcon, permission: 'audit:read' },
  { title: 'Configuración', href: '/admin/settings', icon: SettingsIcon, permission: 'business_config:read' },
];

/** Los que puede ver este usuario, en el orden de la lista. */
export function navItemsFor(permissions: readonly string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions.includes(item.permission));
}

/** Los cuatro del pulgar, ya filtrados por permiso. */
export function barItemsFor(permissions: readonly string[]): NavItem[] {
  return navItemsFor(permissions)
    .filter((item) => item.bar !== undefined)
    .sort((a, b) => a.bar! - b.bar!)
    .slice(0, 4);
}

/**
 * Si la ruta actual corresponde a este destino.
 *
 * `/admin` es prefijo de todas las demás, así que solo se marca activo en coincidencia exacta.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}
