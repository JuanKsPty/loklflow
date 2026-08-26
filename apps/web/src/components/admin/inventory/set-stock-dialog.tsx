'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BoxesIcon, PencilIcon } from 'lucide-react';
import type { ProductStock, StockSetReason } from '@loklflow/types';
import { DEFAULT_UNITS_PER_PACK, STOCK_SET_REASON_PROMPTS } from '@loklflow/types';
import { inventoryApi } from '@/lib/api/inventory.api';
import {
  cajasRecordadas,
  olvidarCajas,
  packNote,
  packTotal,
  recordarCajas,
} from '@/lib/inventory/packs';
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
 * Lo que se teclea cuando llegó mercancía es un **delta**, no un total.
 *
 * Con los otros dos motivos el número es el stock absoluto: es lo que sabe quien acaba de contar,
 * y pedirle que reste él es pedirle que se equivoque. El delta lo calcula el servidor con la fila
 * bloqueada. Pero «llegó mercancía» lo escribe quien acaba de recibir al repartidor y sabe cuántas
 * cajas trajo, no cuántas botellas quedan; mandar el total obligaría a leerlo antes, y lo que se
 * venda entre esa lectura y el guardado se perdería.
 */
const esEntrada = (motivo: StockSetReason) => motivo === 'purchase';

/**
 * La calculadora de cajas sale en los dos motivos cuyo número se puede contar por cartones —«conté
 * 6 cajas, tengo 144» y «llegaron 6 cajas»— y **no** en la merma.
 *
 * Ahí el campo es absoluto: rellenarlo con 24 por «se dañó una caja» dejaría el stock *en* 24 en
 * vez de restarle 24, que es la única combinación en la que el número de cajas no se lee solo.
 */
const admiteCajas = (motivo: StockSetReason) => motivo !== 'waste';

/**
 * «Ahora tengo N», y también «llegaron N».
 *
 * El motivo son tres botones y no un campo de texto. La regla del sistema es que un ajuste sin
 * motivo es un descuadre que nadie podrá explicar dentro de seis meses; esto la cumple **sin
 * escribir nada**, que es lo único que funciona en un teclado de móvil a las once de la noche.
 *
 * La calculadora de cajas es solo eso: rellena el campo grande para no multiplicar de cabeza
 * delante del estante, y el campo grande sigue siendo editable. Lo que viaja es siempre el total.
 */
export function SetStockDialog({ product, compact }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState<StockSetReason>('count');
  const [cajas, setCajas] = useState('');
  const [porCaja, setPorCaja] = useState(String(DEFAULT_UNITS_PER_PACK));
  const [mostrarCajas, setMostrarCajas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir(next: boolean) {
    setOpen(next);
    if (next) {
      setMotivo('count');
      // Se precarga con lo que hay: la corrección habitual es de una o dos unidades, no un número
      // nuevo desde cero.
      setValor(product.currentStock === null ? '' : String(product.currentStock));
      setCajas('');
      setError(null);
      // La calculadora sale desplegada solo donde ya se usó. Es lo que hace que las cervezas la
      // encuentren abierta y el resto de la carta no la vea, sin configurar nada en ningún sitio.
      const recordado = cajasRecordadas(product.productId);
      setMostrarCajas(recordado !== null);
      setPorCaja(String(recordado ?? DEFAULT_UNITS_PER_PACK));
    }
  }

  /** Cambiar de motivo cambia qué significa el número, así que el campo se vuelve a sembrar. */
  function cambiarMotivo(m: StockSetReason) {
    setMotivo(m);
    setCajas('');
    setError(null);
    setValor(esEntrada(m) ? '' : product.currentStock === null ? '' : String(product.currentStock));
  }

  /** Tocar las cajas reescribe el total. Editar el total a mano no toca las cajas: manda el total. */
  function recalcular(siguienteCajas: string, siguientePorCaja: string) {
    setCajas(siguienteCajas);
    setPorCaja(siguientePorCaja);
    setError(null);
    const total = packTotal(siguienteCajas, siguientePorCaja);
    if (total !== null) setValor(String(total));
  }

  const numero = Number(valor.replace(',', '.'));
  const valido = valor.trim() !== '' && !Number.isNaN(numero);
  const entrada = esEntrada(motivo);
  // Solo en modo entrada: ahí el número tecleado no es el resultado, así que hay que decir cuál es.
  const quedaran =
    valido && entrada ? Number(((product.currentStock ?? 0) + numero).toFixed(3)) : null;

  async function guardar() {
    if (!valido) {
      setError(entrada ? 'Escribe cuántas unidades llegaron.' : 'Escribe cuántas unidades hay.');
      return;
    }
    if (entrada && numero <= 0) {
      setError('Una entrada tiene que ser mayor que cero.');
      return;
    }

    const cantidad = Number(numero.toFixed(3));
    // La frase solo se manda si el total sigue siendo el de las cajas. Si se corrigió a mano —seis
    // cajas y tres sueltas— el libro mayor prefiere no decir nada a decir «6 cajas × 24» sobre 147.
    const nota =
      mostrarCajas && admiteCajas(motivo) ? packNote(cajas, porCaja, cantidad) : undefined;

    setEnviando(true);
    try {
      if (entrada) {
        await inventoryApi.productStock.addEntry(product.productId, {
          quantity: cantidad,
          note: nota,
        });
        toast.success(`${product.name}: +${cantidad}`);
      } else {
        await inventoryApi.productStock.set(product.productId, {
          newStock: cantidad,
          reasonCode: motivo,
          note: nota,
        });
        toast.success(`${product.name}: ${cantidad}`);
      }
      // La memoria se actualiza con lo que acaba de funcionar: plegar la calculadora es la forma de
      // decir que este producto no se cuenta por cajas.
      if (mostrarCajas) recordarCajas(product.productId, Number(porCaja) || DEFAULT_UNITS_PER_PACK);
      else olvidarCajas(product.productId);
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
                  onClick={() => cambiarMotivo(m)}
                >
                  {STOCK_SET_REASON_PROMPTS[m]}
                </Button>
              ))}
            </div>
          </Field>

          {admiteCajas(motivo) &&
            (mostrarCajas ? (
              <Field>
                {/* Sin `htmlFor`: rotula los dos campos, como «¿Qué pasó?» rotula los tres
                    botones. El nombre de cada uno lo da su `aria-label`. */}
                <FieldLabel>Contar por cajas</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    // `numeric` y no `decimal`: media caja no existe.
                    inputMode="numeric"
                    placeholder="0"
                    value={cajas}
                    onChange={(e) => recalcular(e.target.value, porCaja)}
                    className="w-20 font-mono tabular-nums"
                    aria-label="Cajas"
                  />
                  <span aria-hidden className="text-muted-foreground">
                    ×
                  </span>
                  <Input
                    inputMode="numeric"
                    value={porCaja}
                    onChange={(e) => recalcular(cajas, e.target.value)}
                    className="w-20 font-mono tabular-nums"
                    aria-label="Unidades por caja"
                  />
                  <span className="text-sm text-muted-foreground">por caja</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setMostrarCajas(false);
                      setCajas('');
                    }}
                  >
                    Ocultar
                  </Button>
                </div>
              </Field>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="justify-center"
                onClick={() => setMostrarCajas(true)}
              >
                <BoxesIcon />
                Contar por cajas
              </Button>
            ))}

          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="stock-actual">
              {entrada ? '¿Cuántas unidades llegaron?' : 'Unidades que hay ahora'}
            </FieldLabel>
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
            {quedaran !== null && !error && (
              <p className="text-sm text-muted-foreground tabular-nums">Quedarán {quedaran}.</p>
            )}
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
