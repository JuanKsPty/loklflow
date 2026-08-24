'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PencilIcon } from 'lucide-react';
import type { ProductStock, StockSetReason } from '@loklflow/types';
import { STOCK_SET_REASON_PROMPTS } from '@loklflow/types';
import { inventoryApi } from '@/lib/api/inventory.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { cn } from '@/lib/utils';

interface Props {
  product: ProductStock;
  /** Variante compacta para la fila de la tabla de escritorio. */
  compact?: boolean;
}

const MOTIVOS: StockSetReason[] = ['count', 'purchase', 'waste'];

/**
 * «Ahora tengo N.»
 *
 * Se pide el stock **absoluto**, no el delta: es lo que sabe quien acaba de contar, y pedirle que
 * reste él es pedirle que se equivoque. El delta lo calcula el servidor con la fila bloqueada.
 *
 * El motivo son tres botones y no un campo de texto. La regla del sistema es que un ajuste sin
 * motivo es un descuadre que nadie podrá explicar dentro de seis meses; esto la cumple **sin
 * escribir nada**, que es lo único que funciona en un teclado de móvil a las once de la noche.
 */
export function SetStockDialog({ product, compact }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState<StockSetReason>('count');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir(next: boolean) {
    setOpen(next);
    if (next) {
      // Se precarga con lo que hay: la corrección habitual es de una o dos unidades, no un número
      // nuevo desde cero.
      setValor(product.currentStock === null ? '' : String(product.currentStock));
      setMotivo('count');
      setError(null);
    }
  }

  async function guardar() {
    const numero = Number(valor.replace(',', '.'));
    if (valor.trim() === '' || Number.isNaN(numero)) {
      setError('Escribe cuántas unidades hay.');
      return;
    }

    setEnviando(true);
    try {
      await inventoryApi.productStock.set(product.productId, {
        newStock: Number(numero.toFixed(3)),
        reasonCode: motivo,
      });
      toast.success(`${product.name}: ${numero}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger
        render={
          <Button variant={product.tracked ? 'outline' : 'default'} size={compact ? 'sm' : 'touch'}>
            {compact ? null : <PencilIcon />}
            {product.tracked ? 'Actualizar' : 'Llevar stock'}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            {product.currentStock === null
              ? 'Aún no se llevan existencias de este producto.'
              : `Ahora mismo hay ${product.currentStock}.`}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>¿Qué pasó?</FieldLabel>
            {/* Tres botones y no un desplegable: es un toque en vez de dos y se leen de un vistazo. */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {MOTIVOS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={motivo === m ? 'default' : 'outline'}
                  size="touch"
                  className="justify-center"
                  onClick={() => setMotivo(m)}
                >
                  {STOCK_SET_REASON_PROMPTS[m]}
                </Button>
              ))}
            </div>
          </Field>

          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="stock-actual">Unidades que hay ahora</FieldLabel>
            <Input
              id="stock-actual"
              // `decimal` y no `number`: en iOS es la diferencia entre el teclado numérico y el
              // alfanumérico, y este campo se teclea de pie delante del estante.
              inputMode="decimal"
              value={valor}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setValor(e.target.value);
                setError(null);
              }}
              className="text-2xl font-mono tabular-nums"
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="touch" />}>Cancelar</DialogClose>
          <Button size="touch" disabled={enviando} onClick={guardar} className={cn('min-w-32')}>
            {enviando && <Spinner />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
