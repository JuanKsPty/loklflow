'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { WalletIcon } from 'lucide-react';
import { shiftsApi } from '@/lib/api/shifts.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
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

/**
 * Sin turno de caja abierto no se puede cobrar, y eso **no se relaja**: una venta que no cae en
 * ningún arqueo es dinero que no cuadra a fin de día.
 *
 * Lo que sí se puede es quitar la fricción: el turno se abre desde aquí, de un toque, en vez de
 * mandar al operario a otra pantalla a buscar cómo. El fondo de caja por defecto es cero porque
 * en un mostrador lo normal es no tener cambio inicial; quien lo tenga, lo escribe.
 */
export function OpenShiftNotice() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fondo, setFondo] = useState('0');
  const [enviando, setEnviando] = useState(false);

  async function abrir() {
    const cantidad = Number(fondo.replace(',', '.'));
    if (Number.isNaN(cantidad) || cantidad < 0) {
      toast.error('El fondo de caja no puede ser negativo');
      return;
    }
    setEnviando(true);
    try {
      await shiftsApi.open({ openingCash: Number(cantidad.toFixed(2)) });
      toast.success('Turno abierto');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir el turno');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <WalletIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>No tienes un turno de caja abierto.</strong> Ábrelo para que lo que vendas cuente
          en el arqueo del día.
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button size="touch" className="w-full shrink-0 sm:w-auto">
              Abrir turno
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir turno de caja</DialogTitle>
            <DialogDescription>
              A partir de ahora, lo que cobres se suma a este turno hasta que lo cierres.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="fondo-caja">Efectivo con el que empiezas</FieldLabel>
            <Input
              id="fondo-caja"
              inputMode="decimal"
              value={fondo}
              onChange={(e) => setFondo(e.target.value)}
              className="font-mono text-2xl tabular-nums"
            />
            <FieldDescription>
              Es el cambio que tienes en el cajón. Si no tienes nada, déjalo en cero.
            </FieldDescription>
          </Field>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="touch" />}>Cancelar</DialogClose>
            <Button size="touch" disabled={enviando} onClick={abrir}>
              {enviando && <Spinner />}
              Abrir turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
