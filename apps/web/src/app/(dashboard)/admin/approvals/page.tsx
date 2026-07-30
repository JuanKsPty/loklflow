import Link from 'next/link';
import type { Discount, DiscountStatus, Paginated } from '@loklflow/types';
import { serverFetch } from '@/lib/api/server-client';
import { hasPermission } from '@/lib/auth/server-user';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageHref } from '@/components/ui/pagination';
import { ApprovalsTable } from '@/components/admin/approvals/approvals-table';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';

export const metadata = { title: 'Aprobaciones — LoklFlow' };

const BASE_PATH = '/admin/approvals';
const TABS: { value: DiscountStatus; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'rejected', label: 'Rechazados' },
];

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function ApprovalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status: DiscountStatus = TABS.some((t) => t.value === sp.status)
    ? (sp.status as DiscountStatus)
    : 'pending';
  const page = Math.max(1, Number(sp.page) || 1);

  const [result, canResolve] = await Promise.all([
    serverFetch<Paginated<Discount>>(`/discounts?status=${status}&page=${page}`).catch(
      // tabla vacía si la API no responde
      () => ({ data: [], total: 0, page, limit: 50 }) as Paginated<Discount>,
    ),
    hasPermission('pos:approve_discount'),
  ]);

  return (
    <div>
      <PageHeader
        title="Aprobaciones"
        description="Descuentos que superan el límite del rol de quien los solicitó."
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={pageHref(BASE_PATH, { status: t.value }, 1)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
              status === t.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <ApprovalsTable
        discounts={result.data}
        resolvable={canResolve && status === 'pending'}
      />

      <Pagination
        basePath={BASE_PATH}
        params={{ status }}
        page={result.page}
        limit={result.limit}
        total={result.total}
        itemLabel="solicitudes"
        className="mt-3"
      />

      {/* Un descuento aprobado cambia el total de la orden. */}
      <RealtimeRefresher events={['order:changed']} />
    </div>
  );
}
