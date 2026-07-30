import { notFound } from 'next/navigation';
import type { BusinessConfig, Order, PaymentSummary } from '@loklflow/types';
import { taxBreakdown } from '@loklflow/types';
import { serverFetch } from '@/lib/api/server-client';
import { formatPrice } from '@/lib/format';
import { PAYMENT_METHOD_LABELS } from '@loklflow/types';
import { PrintButton } from '@/components/pos/print-button';

export const metadata = { title: 'Recibo — LoklFlow' };

interface Props {
  params: Promise<{ id: string }>;
}

function formatDateTime(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

export default async function ReceiptPage({ params }: Props) {
  const { id } = await params;

  let order: Order;
  let summary: PaymentSummary;
  let config: BusinessConfig | null = null;
  try {
    [order, summary] = await Promise.all([
      serverFetch<Order>(`/orders/${id}`),
      serverFetch<PaymentSummary>(`/orders/${id}/payments`),
    ]);
  } catch {
    notFound();
  }
  try {
    config = await serverFetch<BusinessConfig>('/business-config');
  } catch {
    // el recibo se imprime igual, solo sin el encabezado del negocio
  }

  const items = (order.items ?? []).filter((i) => i.status !== 'cancelled');
  const rate = Number(config?.taxRate) || 0;
  // El precio del menú ya incluye el impuesto: aquí solo se desglosa.
  const { base, tax } = taxBreakdown(order.total, rate);

  return (
    <div className="mx-auto max-w-[80mm] px-4 py-6 print:px-0 print:py-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <article className="receipt font-mono text-[11px] leading-snug">
        <header className="mb-3 text-center">
          <h1 className="text-sm font-bold uppercase">
            {config?.businessName ?? 'Recibo'}
          </h1>
          {config?.taxId && <p>{config.taxId}</p>}
          {config?.address && <p>{config.address}</p>}
          {config?.phone && <p>Tel. {config.phone}</p>}
        </header>

        <div className="border-y border-dashed py-1">
          <Row label="Cuenta" value={`#${order.orderNumber}`} />
          {order.table && <Row label="Mesa" value={String(order.table.number)} />}
          <Row
            label="Fecha"
            value={formatDateTime(order.createdAt, config?.timezone)}
          />
        </div>

        <table className="my-2 w-full">
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="pr-1 tabular-nums">{item.quantity}×</td>
                <td className="pr-1">
                  {item.product?.name ?? 'Producto'}
                  {(item.modifiers ?? []).length > 0 && (
                    <span className="block pl-2 opacity-70">
                      {(item.modifiers ?? [])
                        .map((m) => m.modifierOption?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </td>
                <td className="text-right tabular-nums whitespace-nowrap">
                  {formatPrice(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed pt-1">
          <Row label="Subtotal" value={formatPrice(order.subtotal)} />
          {Number(order.discountAmount) > 0 && (
            <Row label="Descuento" value={`−${formatPrice(order.discountAmount)}`} />
          )}
          {Number(order.tipAmount) > 0 && (
            <Row label="Propina" value={formatPrice(order.tipAmount)} />
          )}
          <div className="mt-1 flex justify-between border-t pt-1 text-xs font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </div>
          {rate > 0 && (
            <div className="mt-1 opacity-70">
              <Row label={`Base imponible`} value={formatPrice(base)} />
              <Row label={`IVA ${rate}% incluido`} value={formatPrice(tax)} />
            </div>
          )}
        </div>

        {summary.payments.length > 0 && (
          <div className="mt-2 border-t border-dashed pt-1">
            {summary.payments.map((p) => (
              <Row
                key={p.id}
                label={PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                value={formatPrice(p.amount)}
              />
            ))}
            {summary.remaining > 0.001 && (
              <Row label="Pendiente" value={formatPrice(summary.remaining)} />
            )}
          </div>
        )}

        <footer className="mt-4 text-center">
          {config?.receiptFooter && <p>{config.receiptFooter}</p>}
          {config?.email && <p className="opacity-70">{config.email}</p>}
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}
