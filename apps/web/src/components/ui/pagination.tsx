import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/**
 * Paginación para Server Components: navega con <Link> sobre los searchParams, sin
 * estado de cliente. Preserva el resto de los query params, así que los filtros activos
 * sobreviven al cambiar de página.
 */

/** Construye el href de una página conservando los demás parámetros. */
function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && key !== 'page') search.set(key, value)
  }
  // La primera página no lleva ?page=1, para que la URL canónica quede limpia.
  if (page > 1) search.set('page', String(page))
  const qs = search.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * Ventana de páginas alrededor de la actual, con elipsis. Siempre incluye la primera y
 * la última para poder saltar a los extremos.
 */
export function paginationRange(
  current: number,
  totalPages: number,
  siblings = 1,
): (number | 'ellipsis')[] {
  // Con pocas páginas se listan todas: la elipsis solo estorbaría.
  const maxVisible = siblings * 2 + 5
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const left = Math.max(current - siblings, 1)
  const right = Math.min(current + siblings, totalPages)
  const range: (number | 'ellipsis')[] = []

  range.push(1)
  if (left > 2) range.push('ellipsis')
  for (let p = Math.max(left, 2); p <= Math.min(right, totalPages - 1); p++) {
    range.push(p)
  }
  if (right < totalPages - 1) range.push('ellipsis')
  range.push(totalPages)

  return range
}

interface PaginationProps {
  /** Ruta sin query string, p. ej. "/admin/audit". */
  basePath: string
  /** Query params actuales; se conservan al navegar. */
  params?: Record<string, string | undefined>
  page: number
  limit: number
  total: number
  /** Nombre del elemento en plural, para el resumen ("registros", "órdenes"). */
  itemLabel?: string
  className?: string
}

export function Pagination({
  basePath,
  params = {},
  page,
  limit,
  total,
  itemLabel = 'registros',
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const current = Math.min(Math.max(1, page), totalPages)

  // Una sola página: el resumen sigue siendo útil, los controles no.
  const first = total === 0 ? 0 : (current - 1) * limit + 1
  const last = Math.min(current * limit, total)

  const linkClass = (active: boolean) =>
    cn(
      buttonVariants({ variant: active ? 'default' : 'outline', size: 'icon-sm' }),
      'tabular-nums',
    )

  return (
    <nav
      aria-label="Paginación"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 pt-1 text-sm',
        className,
      )}
    >
      <p className="text-muted-foreground tabular-nums">
        {total === 0 ? `Sin ${itemLabel}` : `${first}–${last} de ${total} ${itemLabel}`}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {current > 1 ? (
            <Link
              href={pageHref(basePath, params, current - 1)}
              aria-label="Página anterior"
              className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
            >
              <ChevronLeftIcon />
            </Link>
          ) : (
            <span
              aria-hidden
              className={cn(
                buttonVariants({ variant: 'outline', size: 'icon-sm' }),
                'pointer-events-none opacity-50',
              )}
            >
              <ChevronLeftIcon />
            </span>
          )}

          {paginationRange(current, totalPages).map((item, i) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${i}`}
                aria-hidden
                className="text-muted-foreground px-1"
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={pageHref(basePath, params, item)}
                aria-label={`Página ${item}`}
                aria-current={item === current ? 'page' : undefined}
                className={linkClass(item === current)}
              >
                {item}
              </Link>
            ),
          )}

          {current < totalPages ? (
            <Link
              href={pageHref(basePath, params, current + 1)}
              aria-label="Página siguiente"
              className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
            >
              <ChevronRightIcon />
            </Link>
          ) : (
            <span
              aria-hidden
              className={cn(
                buttonVariants({ variant: 'outline', size: 'icon-sm' }),
                'pointer-events-none opacity-50',
              )}
            >
              <ChevronRightIcon />
            </span>
          )}
        </div>
      )}
    </nav>
  )
}

export { pageHref }
