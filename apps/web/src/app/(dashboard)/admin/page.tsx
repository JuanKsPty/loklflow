import Link from 'next/link';
import {
  BanknoteIcon,
  ClockIcon,
  PercentIcon,
  ReceiptTextIcon,
  TimerIcon,
  UtensilsCrossedIcon,
} from 'lucide-react';
import type {
  PrepTimeMetric,
  SalesByDay,
  SalesSummary,
  TopProduct,
} from '@loklflow/types';
import { serverFetch } from '@/lib/api/server-client';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/admin/dashboard/stat-card';
import { SalesChart } from '@/components/admin/dashboard/sales-chart';
import { MethodChart } from '@/components/admin/dashboard/method-chart';
import { ExportButton } from '@/components/admin/dashboard/export-button';
import { RealtimeRefresher } from '@/components/realtime/realtime-refresher';

export const metadata = { title: 'Panel — LoklFlow' };

const RANGES = [
  { value: 'today', label: 'Hoy', days: 0 },
  { value: '7d', label: '7 días', days: 6 },
  { value: '30d', label: '30 días', days: 29 },
] as const;

type RangeValue = (typeof RANGES)[number]['value'];

interface Props {
  searchParams: Promise<{ range?: string }>;
}

/** Rango en ISO a partir del selector, en la zona horaria del servidor. */
function resolveRange(value: RangeValue) {
  const days = RANGES.find((r) => r.value === value)?.days ?? 0;
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default async function DashboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const range: RangeValue = RANGES.some((r) => r.value === sp.range)
    ? (sp.range as RangeValue)
    : 'today';
  const { from, to } = resolveRange(range);
  const q = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const empty: SalesSummary = {
    from,
    to,
    totalSales: 0,
    paymentsCount: 0,
    byMethod: { cash: 0, card: 0, transfer: 0, digital_wallet: 0 },
    ordersClosed: 0,
    averageTicket: 0,
    totalDiscounts: 0,
    totalTips: 0,
    openOrders: 0,
    openOrdersValue: 0,
  };

  const [summary, topProducts, prep, byDay] = await Promise.all([
    serverFetch<SalesSummary>(`/reports/sales-summary${q}`).catch(() => empty),
    serverFetch<TopProduct[]>(`/reports/top-products${q}`).catch(() => [] as TopProduct[]),
    serverFetch<PrepTimeMetric>(`/reports/prep-times${q}`).catch(
      () => ({ averageMinutes: null, averageKitchenMinutes: null, sampleSize: 0 }),
    ),
    serverFetch<SalesByDay[]>(`/reports/sales-by-day${q}`).catch(() => [] as SalesByDay[]),
  ]);

  const maxQty = Math.max(1, ...topProducts.map((p) => p.quantity));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Panel"
        description="Ventas, cuentas abiertas y tiempos de preparación."
        action={<ExportButton from={from} to={to} label={range} />}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={r.value === 'today' ? '/admin' : `/admin?range=${r.value}`}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
              range === r.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cobrado"
          value={formatPrice(summary.totalSales)}
          hint={`${summary.paymentsCount} pago(s)`}
          tone="success"
          icon={<BanknoteIcon className="size-4" />}
        />
        <StatCard
          label="Ticket promedio"
          value={formatPrice(summary.averageTicket)}
          hint={`${summary.ordersClosed} cuenta(s) cerrada(s)`}
          icon={<ReceiptTextIcon className="size-4" />}
        />
        <StatCard
          label="Cuentas abiertas"
          value={String(summary.openOrders)}
          hint={`${formatPrice(summary.openOrdersValue)} por cobrar`}
          tone={summary.openOrders > 0 ? 'primary' : 'default'}
          icon={<ClockIcon className="size-4" />}
        />
        <StatCard
          label="Tiempo de preparación"
          value={prep.averageMinutes === null ? '—' : `${prep.averageMinutes} min`}
          hint={
            prep.sampleSize > 0
              ? `${prep.sampleSize} orden(es)${
                  prep.averageKitchenMinutes !== null
                    ? ` · cocina ${prep.averageKitchenMinutes} min`
                    : ''
                }`
              : 'Sin órdenes listas en el periodo'
          }
          icon={<TimerIcon className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por día</CardTitle>
            <CardDescription>Importe cobrado en el periodo.</CardDescription>
          </CardHeader>
          <CardContent>
            {byDay.length > 0 ? (
              <SalesChart data={byDay} />
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Sin cobros en el periodo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por método de pago</CardTitle>
            <CardDescription>Reparto de lo cobrado.</CardDescription>
          </CardHeader>
          <CardContent>
            <MethodChart byMethod={summary.byMethod} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Más vendidos</CardTitle>
            <CardDescription>Por unidades en el periodo.</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Sin ventas en el periodo.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topProducts.map((p) => (
                  <li key={p.productId}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{p.name}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {p.quantity} · {formatPrice(p.revenue)}
                      </span>
                    </div>
                    {/* Barra con ancho porcentual: sin JavaScript. */}
                    <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(p.quantity / maxQty) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Descuentos y propinas</CardTitle>
            <CardDescription>Sobre las cuentas cerradas del periodo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                <PercentIcon className="size-4" />
                Descuentos aplicados
              </span>
              <span className="tabular-nums font-medium">
                {formatPrice(summary.totalDiscounts)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                <UtensilsCrossedIcon className="size-4" />
                Propinas
              </span>
              <span className="tabular-nums font-medium">
                {formatPrice(summary.totalTips)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cerrar una cuenta en el POS repinta los KPIs sin recargar. */}
      <RealtimeRefresher events={['order:changed', 'shift:changed']} />
    </div>
  );
}
