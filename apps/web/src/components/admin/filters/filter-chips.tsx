import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { hrefWith, type UrlParams } from '@/lib/url';

export interface ChipOption {
  /** `undefined` es el chip de «todos»: navega quitando el parámetro. */
  value?: string;
  label: string;
  /** Un número al lado, como el de «bajo mínimo». */
  badge?: number;
}

/**
 * Los chips de filtro del panel, en un solo componente.
 *
 * Había cuatro copias casi idénticas de esto —bajo mínimo, auditoría, aprobaciones y las
 * categorías del POS— y este trabajo iba a añadir la quinta.
 *
 * Enlaces y no estado de cliente, que es la regla que el panel ya se puso: así la vista filtrada
 * es una URL que se puede guardar, mandar por mensaje y abrir cada mañana, y quien filtra lo hace
 * es el servidor.
 */
export function FilterChips({
  basePath,
  params,
  name,
  options,
  label,
}: {
  basePath: string;
  params: UrlParams;
  name: string;
  options: ChipOption[];
  label: string;
}) {
  const actual = params[name];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={label}>
      {options.map((o) => {
        const activo = o.value === undefined ? !actual : String(actual) === o.value;
        return (
          <Link
            key={o.value ?? '__todos__'}
            href={hrefWith(basePath, params, { [name]: o.value })}
            aria-current={activo ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm transition-colors',
              activo
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {o.label}
            {o.badge !== undefined && o.badge > 0 && (
              <Badge variant={activo ? 'secondary' : 'destructive'} className="ml-1.5">
                {o.badge}
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}
