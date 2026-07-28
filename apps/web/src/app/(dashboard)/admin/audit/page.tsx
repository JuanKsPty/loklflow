import Link from 'next/link';
import { AUDIT_ACTIONS, type AuditAction, type AuditLog, type Paginated } from '@loklflow/types';
import { serverFetch } from '@/lib/api/server-client';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination, pageHref } from '@/components/ui/pagination';
import { AuditTable } from '@/components/admin/audit/audit-table';
import { AUDIT_FILTER_GROUPS } from '@/components/admin/audit/constants';

export const metadata = { title: 'Auditoría — LoklFlow' };

const BASE_PATH = '/admin/audit';
const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{
    page?: string;
    action?: string;
    from?: string;
    to?: string;
  }>;
}

/** Solo se acepta una acción del catálogo; cualquier otra cosa se ignora. */
function parseAction(value: string | undefined): AuditAction | undefined {
  return value && (AUDIT_ACTIONS as string[]).includes(value)
    ? (value as AuditAction)
    : undefined;
}

/** El input date da YYYY-MM-DD; la API espera ISO 8601. */
function toIso(day: string | undefined, endOfDay = false): string | undefined {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  return `${day}T${endOfDay ? '23:59:59.999Z' : '00:00:00.000Z'}`;
}

export default async function AuditPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const action = parseAction(sp.action);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '') ? sp.to : undefined;

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (action) query.set('action', action);
  const fromIso = toIso(from);
  const toIsoValue = toIso(to, true);
  if (fromIso) query.set('from', fromIso);
  if (toIsoValue) query.set('to', toIsoValue);

  let result: Paginated<AuditLog> = { data: [], total: 0, page, limit: PAGE_SIZE };
  try {
    result = await serverFetch<Paginated<AuditLog>>(`/audit-logs?${query.toString()}`);
  } catch {
    // muestra la tabla vacía si la API no está disponible
  }

  // Se pasan a la paginación para que los filtros sobrevivan al cambiar de página.
  const activeParams = { action, from, to };
  const hasFilters = Boolean(action || from || to);

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Registro de las acciones críticas del sistema: accesos, cambios de permisos, caja y cancelaciones."
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {AUDIT_FILTER_GROUPS.map((f) => {
            const isActive = f.value === 'all' ? !action : action === f.value;
            // Cambiar de filtro vuelve a la página 1: la anterior no aplica al nuevo total.
            const href = pageHref(
              BASE_PATH,
              { ...activeParams, action: f.value === 'all' ? undefined : f.value },
              1,
            );
            return (
              <Link
                key={f.value}
                href={href}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Formulario GET nativo: funciona sin JavaScript y encaja con el Server Component. */}
        <form action={BASE_PATH} method="get" className="flex flex-wrap items-end gap-2">
          {action && <input type="hidden" name="action" value={action} />}
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Desde</span>
            <Input type="date" name="from" defaultValue={from} className="h-8 w-auto" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Hasta</span>
            <Input type="date" name="to" defaultValue={to} className="h-8 w-auto" />
          </label>
          <Button type="submit" variant="outline" size="sm">
            Filtrar
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={BASE_PATH} />}
            >
              Limpiar
            </Button>
          )}
        </form>
      </div>

      <AuditTable logs={result.data} />

      <Pagination
        basePath={BASE_PATH}
        params={activeParams}
        page={result.page}
        limit={result.limit}
        total={result.total}
        itemLabel="registros"
        className="mt-3"
      />
    </div>
  );
}
