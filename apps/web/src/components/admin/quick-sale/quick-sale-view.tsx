'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MinusIcon, PlusIcon, ReceiptTextIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import type { PaymentMethod, ProductStock } from '@loklflow/types';
import { PAYMENT_METHOD_LABELS } from '@loklflow/types';
import { ordersApi } from '@/lib/api/orders.api';
import { newClientId } from '@/lib/client-id';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/** Los que un mostrador usa de verdad. El resto del catálogo de métodos sigue en el POS. */
const METODOS: PaymentMethod[] = ['cash', 'card', 'transfer'];

interface Linea {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  products: ProductStock[];
  /** `false` cuando no hay turno abierto: la pantalla se ve, pero no deja cobrar. */
  canCharge: boolean;
}

/**
 * Venta de mostrador.
 *
 * Elegir, contar y cobrar. Sin mesa, sin comanda, sin cocina — el flujo de quien despacha y cobra
 * en el mismo gesto.
 *
 * Un producto agotado **se puede vender igual**, con aviso. El stock que puede quedar en negativo
 * es una decisión escrita del sistema (ver `ingredient.entity.ts`): bloquear un cobro por un
 * número de gestión es perder una venta delante del cliente, y el negativo es la señal de que hay
 * que hacer un recuento.
 */
export function QuickSaleView({ products, canCharge }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [metodo, setMetodo] = useState<PaymentMethod>('cash');
  const [cobrando, setCobrando] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  /**
   * El id se acuña **al montar el carrito**, no al pulsar cobrar, y se conserva mientras la venta
   * siga viva. Es lo que hace que un reintento tras un fallo de red devuelva la misma venta en
   * lugar de cobrar dos veces: si se generara en el `submit`, cada toque sería una venta nueva.
   */
  const [ventaId, setVentaId] = useState(() => newClientId());

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLocaleLowerCase('es').includes(q) ||
        (p.categoryName ?? '').toLocaleLowerCase('es').includes(q),
    );
  }, [products, busqueda]);

  const total = lineas.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const unidades = lineas.reduce((sum, l) => sum + l.quantity, 0);

  function sumar(p: ProductStock, delta: number) {
    setLineas((prev) => {
      const actual = prev.find((l) => l.productId === p.productId);
      if (!actual) {
        return delta > 0
          ? [...prev, { productId: p.productId, name: p.name, price: p.price, quantity: delta }]
          : prev;
      }
      const cantidad = actual.quantity + delta;
      if (cantidad <= 0) return prev.filter((l) => l.productId !== p.productId);
      return prev.map((l) => (l.productId === p.productId ? { ...l, quantity: cantidad } : l));
    });
  }

  const enCarrito = (id: string) => lineas.find((l) => l.productId === id)?.quantity ?? 0;

  async function cobrar() {
    if (lineas.length === 0) return;
    setCobrando(true);
    try {
      const { order } = await ordersApi.quickSale({
        id: ventaId,
        items: lineas.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        payment: { method: metodo },
      });

      toast.success(`Venta #${order.orderNumber} cobrada`, {
        description: formatPrice(Number(order.total)),
        action: {
          label: 'Recibo',
          onClick: () => window.open(`/recibo/${order.id}`, '_blank'),
        },
      });

      // Carrito nuevo, id nuevo: la venta anterior ya está cerrada y reutilizar su id devolvería
      // aquella en vez de registrar esta.
      setLineas([]);
      setVentaId(newClientId());
      setCarritoAbierto(false);
      router.refresh();
    } catch (err) {
      // El servidor mete el número de cuenta en el mensaje cuando la venta quedó abierta, así que
      // se muestra tal cual: es lo que le dice al operario qué reintentar.
      toast.error(err instanceof Error ? err.message : 'No se pudo cobrar');
    } finally {
      setCobrando(false);
    }
  }

  const carrito = (
    <div className="flex flex-col gap-3">
      {lineas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Toca un producto para empezar.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {lineas.map((l) => (
            <li key={l.productId} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.name}</p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatPrice(l.price)} × {l.quantity}
                </p>
              </div>
              <span className="font-mono text-sm tabular-nums">
                {formatPrice(l.price * l.quantity)}
              </span>
              <Button
                variant="ghost"
                size="icon-touch"
                aria-label={`Quitar ${l.name}`}
                onClick={() =>
                  setLineas((prev) => prev.filter((x) => x.productId !== l.productId))
                }
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Cómo paga</p>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <Button
              key={m}
              variant={metodo === m ? 'default' : 'outline'}
              size="touch"
              onClick={() => setMetodo(m)}
            >
              {PAYMENT_METHOD_LABELS[m]}
            </Button>
          ))}
        </div>
      </div>

      <Button
        size="touch"
        className="w-full"
        disabled={lineas.length === 0 || cobrando || !canCharge}
        onClick={cobrar}
      >
        {cobrando && <Spinner />}
        Cobrar {formatPrice(total)}
      </Button>
      {!canCharge && (
        <p className="text-center text-xs text-muted-foreground">
          Abre el turno de caja para poder cobrar.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex-1">
        <div className="relative mb-3">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un producto"
            aria-label="Buscar un producto"
            className="pl-9"
          />
        </div>

        {visibles.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>Nada que coincida</EmptyTitle>
              <EmptyDescription>Prueba con otra palabra.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {visibles.map((p) => {
              const cantidad = enCarrito(p.productId);
              const agotado = p.tracked && (p.currentStock ?? 0) <= 0;
              return (
                <li key={p.productId}>
                  <button
                    type="button"
                    onClick={() => sumar(p, 1)}
                    className={cn(
                      'flex h-full w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors',
                      cantidad > 0 ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    <span className="mt-auto font-mono text-base tabular-nums">
                      {formatPrice(p.price)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {p.tracked ? (
                        <span
                          className={cn(
                            'font-mono text-xs tabular-nums',
                            agotado ? 'text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {agotado ? 'Sin existencias' : `Quedan ${p.currentStock}`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin control</span>
                      )}
                      {cantidad > 0 && (
                        <Badge className="ml-auto font-mono tabular-nums">{cantidad}</Badge>
                      )}
                    </span>
                  </button>

                  {cantidad > 0 && (
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <Button
                        variant="outline"
                        size="icon-touch"
                        aria-label={`Quitar una unidad de ${p.name}`}
                        onClick={() => sumar(p, -1)}
                      >
                        <MinusIcon />
                      </Button>
                      <span className="font-mono text-sm tabular-nums">{cantidad}</span>
                      <Button
                        variant="outline"
                        size="icon-touch"
                        aria-label={`Añadir una unidad de ${p.name}`}
                        onClick={() => sumar(p, 1)}
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* En escritorio el carrito vive al lado; en el teléfono, en una hoja que sube desde abajo. */}
      <aside className="hidden w-80 shrink-0 rounded-xl border p-4 lg:block">
        <p className="mb-3 flex items-center gap-2 font-medium">
          <ReceiptTextIcon className="size-4" />
          Venta
        </p>
        {carrito}
      </aside>

      {/*
        Barra de acción fija en el teléfono. La barra de navegación inferior se oculta en esta
        ruta (`SIN_BARRA` en `admin-bottom-nav.tsx`) para que no se apilen dos.
      */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Sheet open={carritoAbierto} onOpenChange={setCarritoAbierto}>
          <SheetTrigger
            render={
              <Button size="touch" className="w-full" disabled={lineas.length === 0}>
                <span>
                  {unidades} {unidades === 1 ? 'artículo' : 'artículos'}
                </span>
                <span className="ml-auto font-mono tabular-nums">{formatPrice(total)}</span>
              </Button>
            }
          />
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Cobrar</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">{carrito}</div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
