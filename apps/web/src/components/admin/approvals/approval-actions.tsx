'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { discountsApi } from '@/lib/api/discounts.api';
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

interface Props {
  discountId: string;
  amountLabel: string;
}

export function ApprovalActions({ discountId, amountLabel }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      setRejectOpen(false);
      setReason('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al resolver el descuento');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        disabled={busy}
        onClick={() => run(() => discountsApi.approve(discountId), 'Descuento aprobado')}
      >
        {busy && <Spinner />}
        Aprobar
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy}>
              Rechazar
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar descuento</DialogTitle>
            <DialogDescription>
              {amountLabel}. El motivo se le mostrará a quien lo solicitó.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel className="text-xs">Motivo (opcional)</FieldLabel>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="No procede en este caso"
              maxLength={255}
              disabled={busy}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={busy} />}>Cancelar</DialogClose>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(
                  () => discountsApi.reject(discountId, reason.trim() || undefined),
                  'Descuento rechazado',
                )
              }
            >
              {busy && <Spinner />}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
