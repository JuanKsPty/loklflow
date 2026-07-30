'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PercentIcon } from 'lucide-react';
import type { DiscountType, Order } from '@loklflow/types';
import { discountsApi } from '@/lib/api/discounts.api';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  order: Order;
  /**
   * Umbral del rol en porcentaje. Se usa solo para avisar en la UI de que el descuento
   * necesitará aprobación; la decisión real la toma el backend.
   */
  maxDiscountPercentage: number;
  disabled?: boolean;
  onApplied: () => void;
}

export function DiscountDialog({
  order,
  maxDiscountPercentage,
  disabled,
  onApplied,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const subtotal = Number(order.subtotal) || 0;
  const valueNum = Number(value) || 0;

  // Importe y porcentaje previstos, para que el cajero vea a qué se compromete.
  const amount =
    type === 'percentage' ? Number(((subtotal * valueNum) / 100).toFixed(2)) : valueNum;
  const percentage =
    subtotal > 0 ? Number(((amount / subtotal) * 100).toFixed(2)) : valueNum > 0 ? 100 : 0;

  const needsApproval = percentage > maxDiscountPercentage;
  const exceedsSubtotal = amount > subtotal;
  const canSubmit =
    !busy && valueNum > 0 && reason.trim().length >= 3 && !exceedsSubtotal;

  async function submit() {
    setBusy(true);
    try {
      const discount = await discountsApi.request(order.id, {
        type,
        value: Number(valueNum.toFixed(2)),
        reason: reason.trim(),
      });
      if (discount.status === 'pending') {
        toast.info('Descuento enviado a aprobación');
      } else {
        toast.success('Descuento aplicado');
      }
      setOpen(false);
      setValue('');
      setReason('');
      onApplied();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aplicar el descuento');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled}>
            <PercentIcon />
            Descuento
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar descuento</DialogTitle>
          <DialogDescription>
            Tu rol autoriza hasta {maxDiscountPercentage}% sin aprobación.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel className="text-xs">Tipo</FieldLabel>
          <div className="flex gap-2">
            {(['percentage', 'fixed'] as DiscountType[]).map((t) => (
              <Button
                key={t}
                type="button"
                variant={type === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType(t)}
                disabled={busy}
              >
                {t === 'percentage' ? 'Porcentaje' : 'Importe'}
              </Button>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel className="text-xs">
            {type === 'percentage' ? 'Porcentaje (%)' : 'Importe'}
          </FieldLabel>
          <Input
            type="number"
            min={0}
            max={type === 'percentage' ? 100 : undefined}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            autoFocus
          />
          {valueNum > 0 && (
            <FieldDescription>
              {exceedsSubtotal
                ? `El descuento supera el subtotal de ${formatPrice(subtotal)}.`
                : `Se descontarán ${formatPrice(amount)} de ${formatPrice(subtotal)} (${percentage}%).`}
            </FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel className="text-xs">Motivo</FieldLabel>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cliente frecuente, error de cocina…"
            maxLength={255}
            disabled={busy}
          />
          <FieldDescription>Obligatorio: queda registrado en la bitácora.</FieldDescription>
        </Field>

        {valueNum > 0 && !exceedsSubtotal && (
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-xs',
              needsApproval
                ? 'bg-amber-500/10 text-amber-600'
                : 'bg-success/10 text-success',
            )}
          >
            {needsApproval
              ? 'Supera tu límite: quedará pendiente de aprobación de un gerente y el total no cambiará hasta entonces.'
              : 'Está dentro de tu límite: se aplicará de inmediato.'}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            Cancelar
          </DialogClose>
          <Button onClick={submit} disabled={!canSubmit}>
            {busy && <Spinner />}
            {needsApproval ? 'Enviar a aprobación' : 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
