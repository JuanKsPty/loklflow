'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2Icon } from 'lucide-react';
import type { Order, PaymentMethod, PaymentSummary } from '@loklflow/types';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@loklflow/types';
import { paymentsApi } from '@/lib/api/payments.api';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel } from '@/components/ui/field';

interface Props {
  order: Order;
  /** Se llama cuando la cuenta queda saldada (cerrada). */
  onSettled?: () => void;
}

function sumPaid(order: Order): number {
  return Number((order.payments ?? []).reduce((s, p) => s + Number(p.amount), 0).toFixed(2));
}

export function CheckoutPanel({ order, onSettled }: Props) {
  const router = useRouter();

  const initialPaid = useMemo(() => sumPaid(order), [order]);
  const [summary, setSummary] = useState<PaymentSummary>({
    total: order.total,
    paid: initialPaid,
    remaining: Number(Math.max(0, order.total - initialPaid).toFixed(2)),
    payments: order.payments ?? [],
  });

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState<string>(summary.remaining.toFixed(2));
  const [received, setReceived] = useState<string>('');
  const [reference, setReference] = useState('');
  const [tip, setTip] = useState<string>(order.tipAmount ? String(order.tipAmount) : '');
  const [busy, setBusy] = useState(false);

  const settled = summary.remaining <= 0.001;
  const amountNum = Number(amount) || 0;
  const receivedNum = Number(received) || 0;
  const change = method === 'cash' && receivedNum > amountNum ? receivedNum - amountNum : 0;

  function syncSummary(next: PaymentSummary) {
    setSummary(next);
    setAmount(next.remaining.toFixed(2));
    setReceived('');
    setReference('');
  }

  async function applyTip() {
    const value = Number(tip) || 0;
    setBusy(true);
    try {
      await paymentsApi.setTip(order.id, value);
      const next = await paymentsApi.summary(order.id);
      syncSummary(next);
      toast.success('Propina actualizada');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar propina');
    } finally {
      setBusy(false);
    }
  }

  async function addPayment() {
    if (amountNum <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    setBusy(true);
    try {
      const next = await paymentsApi.addPayment(order.id, {
        method,
        amount: Number(amountNum.toFixed(2)),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      const wasSettled = next.remaining <= 0.001;
      syncSummary(next);
      toast.success(wasSettled ? 'Cuenta cobrada' : 'Pago registrado');
      router.refresh();
      if (wasSettled) onSettled?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar el pago');
    } finally {
      setBusy(false);
    }
  }

  function splitInto(n: number) {
    setAmount((summary.remaining / n).toFixed(2));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen */}
      <div className="rounded-xl border p-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Descuento</span>
            <span className="tabular-nums">−{formatPrice(order.discountAmount)}</span>
          </div>
        )}
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-end gap-2">
            <Field className="w-28">
              <FieldLabel className="text-xs">Propina</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                disabled={busy || settled}
                placeholder="0.00"
              />
            </Field>
            <Button type="button" variant="outline" size="sm" onClick={applyTip} disabled={busy || settled}>
              Aplicar
            </Button>
          </div>
        </div>
        <div className="mt-3 flex justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(summary.total)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Pagado</span>
          <span className="tabular-nums">{formatPrice(summary.paid)}</span>
        </div>
        <div className={cn('flex justify-between text-sm font-medium', settled ? 'text-success' : 'text-primary')}>
          <span>Restante</span>
          <span className="tabular-nums">{formatPrice(summary.remaining)}</span>
        </div>
      </div>

      {/* Pagos registrados */}
      {summary.payments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {summary.payments.map((p) => (
            <div key={p.id} className="flex justify-between rounded-md border px-3 py-2 text-sm">
              <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
              <span className="tabular-nums">{formatPrice(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {settled ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 py-4 text-success">
          <CheckCircle2Icon className="size-5" />
          <span className="font-medium">Cuenta cobrada</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m}
                type="button"
                variant={method === m ? 'default' : 'outline'}
                onClick={() => setMethod(m)}
                disabled={busy}
              >
                {PAYMENT_METHOD_LABELS[m]}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Dividir:</span>
            {[2, 3, 4].map((n) => (
              <Button key={n} type="button" variant="ghost" size="sm" onClick={() => splitInto(n)} disabled={busy}>
                ÷{n}
              </Button>
            ))}
          </div>

          <Field>
            <FieldLabel className="text-xs">Monto a cobrar</FieldLabel>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
          </Field>

          {method === 'cash' && (
            <div className="flex items-end gap-3">
              <Field className="flex-1">
                <FieldLabel className="text-xs">Recibido</FieldLabel>
                <Input type="number" min={0} step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} disabled={busy} placeholder="0.00" />
              </Field>
              <div className="pb-2 text-sm">
                <span className="text-muted-foreground">Cambio: </span>
                <span className="font-semibold tabular-nums">{formatPrice(change)}</span>
              </div>
            </div>
          )}

          {(method === 'card' || method === 'transfer' || method === 'digital_wallet') && (
            <Field>
              <FieldLabel className="text-xs">Referencia (opcional)</FieldLabel>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} disabled={busy} placeholder="Folio / terminal" />
            </Field>
          )}

          <Button type="button" size="lg" onClick={addPayment} disabled={busy}>
            {busy && <Spinner />}
            Registrar pago
          </Button>
        </div>
      )}
    </div>
  );
}
