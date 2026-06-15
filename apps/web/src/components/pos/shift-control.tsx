'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LockIcon, LockOpenIcon } from 'lucide-react';
import type { PaymentMethod, ShiftSummary } from '@loklflow/types';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@loklflow/types';
import { shiftsApi } from '@/lib/api/shifts.api';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel } from '@/components/ui/field';
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

export function ShiftControl({ current }: { current: ShiftSummary | null }) {
  if (!current) return <OpenShiftButton />;
  return <CloseShiftButton current={current} />;
}

function OpenShiftButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await shiftsApi.open({
        openingCash: Number(Number(openingCash || '0').toFixed(2)),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success('Turno abierto');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir turno');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <LockOpenIcon />
            Abrir turno
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir turno de caja</DialogTitle>
          <DialogDescription>Registra el fondo inicial de efectivo.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel className="text-xs">Fondo inicial</FieldLabel>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field>
          <FieldLabel className="text-xs">Notas (opcional)</FieldLabel>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>Cancelar</DialogClose>
          <Button onClick={submit} disabled={busy}>
            {busy && <Spinner />}
            Abrir turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseShiftButton({ current }: { current: ShiftSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const countedNum = Number(closingCash) || 0;
  const difference = closingCash.trim() === '' ? null : Number((countedNum - current.expectedCash).toFixed(2));

  async function submit() {
    setBusy(true);
    try {
      const result = await shiftsApi.close(current.shift.id, {
        closingCash: Number(countedNum.toFixed(2)),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      const diff = result.difference ?? 0;
      toast.success(
        diff === 0
          ? 'Turno cerrado · caja cuadrada'
          : `Turno cerrado · diferencia ${formatPrice(diff)}`,
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar turno');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <LockIcon />
            Turno · {formatPrice(current.totalSales)}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar turno de caja</DialogTitle>
          <DialogDescription>Cuadra el efectivo en caja (arqueo).</DialogDescription>
        </DialogHeader>

        {/* Ventas por método */}
        <div className="rounded-xl border p-3">
          {PAYMENT_METHODS.map((m: PaymentMethod) => (
            <div key={m} className="flex justify-between text-sm text-muted-foreground">
              <span>{PAYMENT_METHOD_LABELS[m]}</span>
              <span className="tabular-nums">{formatPrice(current.byMethod[m] ?? 0)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Ventas del turno</span>
            <span className="tabular-nums">{formatPrice(current.totalSales)}</span>
          </div>
        </div>

        {/* Efectivo */}
        <div className="rounded-xl border p-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Fondo inicial</span>
            <span className="tabular-nums">{formatPrice(current.shift.openingCash)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>+ Ventas en efectivo</span>
            <span className="tabular-nums">{formatPrice(current.cashSales)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t pt-1 font-medium">
            <span>Efectivo esperado</span>
            <span className="tabular-nums">{formatPrice(current.expectedCash)}</span>
          </div>
        </div>

        <Field>
          <FieldLabel className="text-xs">Efectivo contado</FieldLabel>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={closingCash}
            onChange={(e) => setClosingCash(e.target.value)}
            disabled={busy}
            placeholder="0.00"
          />
        </Field>

        {difference !== null && (
          <div
            className={cn(
              'flex justify-between rounded-md px-3 py-2 text-sm font-medium',
              difference === 0
                ? 'bg-success/10 text-success'
                : difference > 0
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/10 text-destructive',
            )}
          >
            <span>Diferencia</span>
            <span className="tabular-nums">{formatPrice(difference)}</span>
          </div>
        )}

        <Field>
          <FieldLabel className="text-xs">Notas (opcional)</FieldLabel>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        </Field>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>Cancelar</DialogClose>
          <Button onClick={submit} disabled={busy || closingCash.trim() === ''}>
            {busy && <Spinner />}
            Cerrar turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
