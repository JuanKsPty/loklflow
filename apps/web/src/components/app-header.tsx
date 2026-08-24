'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

/**
 * El nombre de cada segmento de ruta.
 *
 * Tiene que estar **completo**: lo que falta cae en la heurística de abajo y sale como «Detalle» o
 * como el segmento crudo, así que media navegación del panel decía «Detalle» —`/admin/menu/products`
 * entre otras—. `app-header.spec.tsx` afirma que ninguna ruta real se queda sin etiqueta, así que
 * una sección nueva rompe ese test hasta que se le dé nombre aquí.
 */
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Administración',
  users: 'Empleados',
  roles: 'Roles',
  audit: 'Auditoría',
  approvals: 'Aprobaciones',
  menu: 'Menú',
  products: 'Productos',
  categories: 'Categorías',
  modifiers: 'Modificadores',
  combos: 'Combos',
  tables: 'Mesas',
  sectors: 'Sectores',
  reservations: 'Reservas',
  inventario: 'Inventario',
  ingredientes: 'Ingredientes',
  proveedores: 'Proveedores',
  venta: 'Venta rápida',
  import: 'Importar',
  orders: 'Órdenes',
  settings: 'Configuración',
  new: 'Nuevo',
};

export interface Crumb {
  label: string;
  href: string;
  isLast: boolean;
}

export function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    // Un segmento no mapeado en una posición de detalle es un id → "Detalle".
    const label = SEGMENT_LABELS[segment] ?? (index > 1 ? 'Detalle' : segment);
    return { label, href, isLast };
  });
}

export function AppHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    // Pegajosa: el contenedor no acota su altura, así que quien desplaza es el documento y sin
    // esto la cabecera —con el disparador del cajón dentro— desaparecía al bajar por un listado
    // largo. `z-20` porque el cajón de escritorio ya es `z-10`.
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger className="max-sm:ml-0 sm:-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            // En el teléfono solo los dos últimos: `BreadcrumbList` es `flex-wrap`, así que cuatro
            // migas envuelven a dos líneas y revientan el alto fijo de la cabecera.
            const oculto = index < crumbs.length - 2 ? 'hidden sm:inline-flex' : undefined;
            return (
            <Fragment key={crumb.href}>
              <BreadcrumbItem className={oculto}>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!crumb.isLast && <BreadcrumbSeparator className={oculto} />}
            </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell area="admin" />
        <ThemeToggle />
      </div>
    </header>
  );
}
