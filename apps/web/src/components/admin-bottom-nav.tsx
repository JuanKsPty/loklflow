'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MenuIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { barItemsFor, isNavItemActive } from '@/components/nav-items';

/** Rutas que ocupan la parte de abajo con su propia barra de acción. */
const SIN_BARRA = ['/admin/venta'];

interface Props {
  permissions: string[];
}

/**
 * Los cuatro destinos del día, al alcance del pulgar.
 *
 * El cajón lateral solo no basta, y no es una cuestión de gusto: su disparador está en la esquina
 * **superior izquierda** de una pantalla de 6,7", que es donde no llega quien sujeta el teléfono
 * con una mano; y son dos toques y una lectura de diez ítems para cada salto, varias veces al día.
 * La barra deja lo que se usa a diario en el pulgar y, de paso, indica dónde estás — que es lo que
 * hacía la miga de pan antes de recortarla a dos niveles.
 *
 * El patrón no es importado: `waiter/waiter-nav.tsx` ya lo usa en este repo y ya está cubierto por
 * el proyecto `movil` del e2e.
 *
 * `sm:hidden` y no `md:hidden`: es el mismo escalón que el resto de la parte móvil, para que no
 * haya un tramo en el que ni la barra ni el cajón estén a mano.
 */
export function AdminBottomNav({ permissions }: Props) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const items = barItemsFor(permissions);

  // En una pantalla de tarea, la barra de acción manda: apilar dos barras es lo que obliga a
  // `floor-view.tsx` a subir la suya con `bottom-16`.
  if (items.length === 0 || SIN_BARRA.some((ruta) => pathname.startsWith(ruta))) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      {items.map((item) => {
        const active = isNavItemActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="size-5" />
            {item.title}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MenuIcon className="size-5" />
        Más
      </button>
    </nav>
  );
}
