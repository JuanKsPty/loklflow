'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MinusIcon, PlusIcon, ShoppingBagIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { PublicMenu as Menu, PublicProduct } from '@loklflow/types';
import { publicApi, saveGuestToken } from '@/lib/api/public.api';
import { ApiError, OfflineError } from '@/lib/api/client';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { QrBrandHeader } from './qr-brand-header';
import { PublicModifierDialog } from './public-modifier-dialog';

interface Line {
  key: string;
  product: PublicProduct;
  quantity: number;
  modifierOptionIds: string[];
  unitTotal: number;
}

/**
 * El menú del cliente y su carrito.
 *
 * No reutiliza `PosOrderBuilder` aunque el flujo se parezca, y el motivo no es estético: ese
 * componente importa `ordersApi`, que va por `api` de `client.ts`, que ante un 401 expulsa a
 * `/login`. Un cliente acabaría en el formulario de acceso del personal. Aquí todo pasa por
 * `publicApi`.
 *
 * La forma es de teléfono: chips de categoría que se desplazan, tarjetas grandes de producto, y una
 * barra fija abajo que resume el carrito. Se usa de pie, con una mano y a contraluz, así que los
 * objetivos táctiles no bajan de 44 px por mucho sitio que sobre.
 *
 * En una tableta —que es lo que muchos locales dejan puesto en la mesa— pasa a **dos** columnas.
 * Dos, no cuatro: lo que se gana es carta visible sin encoger la tarjeta, y a partir de ahí cada
 * columna más haría el texto ilegible y el objetivo táctil pequeño.
 */
export function PublicMenu({ qrCode, menu }: { qrCode: string; menu: Menu }) {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [chooseFor, setChooseFor] = useState<PublicProduct | null>(null);
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  /**
   * Envío en curso, en una ref y no solo en el estado.
   *
   * `setSending(true)` no deshabilita el botón hasta el siguiente render, así que un doble toque
   * rápido en un teléfono alcanza a disparar dos peticiones: son dos pedidos idénticos para la misma
   * mesa, y la cocina prepara los dos. Es la misma carrera que `CheckoutPanel` documenta para el
   * cobro, y aquí no hay clave de idempotencia que la cubra — el DTO público rechaza a propósito
   * que el cliente elija identificadores.
   */
  const inFlight = useRef(false);

  const visible = useMemo(
    () => (category ? menu.products.filter((p) => p.categoryId === category) : menu.products),
    [menu.products, category],
  );

  const total = cart.reduce((sum, l) => sum + l.unitTotal * l.quantity, 0);
  const count = cart.reduce((sum, l) => sum + l.quantity, 0);

  function add(product: PublicProduct, modifierOptionIds: string[]) {
    const extra = product.modifiers
      .flatMap((m) => m.options)
      .filter((o) => modifierOptionIds.includes(o.id))
      .reduce((s, o) => s + Number(o.priceAdjustment), 0);

    // La clave agrupa por producto **y** por combinación de modificadores: dos tacos iguales suman
    // cantidad, uno sin cebolla es otra línea.
    const key = `${product.id}|${[...modifierOptionIds].sort().join(',')}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          product,
          quantity: 1,
          modifierOptionIds,
          unitTotal: Number(product.price) + extra,
        },
      ];
    });
    setChooseFor(null);
  }

  function onProductTap(product: PublicProduct) {
    if (product.modifiers.length > 0) {
      setChooseFor(product);
      return;
    }
    add(product, []);
  }

  function changeQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  async function send() {
    if (cart.length === 0 || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    try {
      const created = await publicApi.createOrder(qrCode, {
        ...(name.trim() ? { customerName: name.trim() } : {}),
        items: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          ...(l.modifierOptionIds.length ? { modifierOptionIds: l.modifierOptionIds } : {}),
        })),
      });

      // El pase es lo único que permite volver a mirar el pedido, así que se guarda **antes** de
      // navegar: si la navegación falla, el cliente todavía puede llegar a `/pedido` a mano.
      saveGuestToken(created.trackingToken);
      router.push(`/m/${qrCode}/pedido`);
    } catch (err) {
      if (err instanceof OfflineError) {
        toast.error('No hay conexión. Vuelve a intentarlo o avisa a un mesero.');
      } else if (err instanceof ApiError) {
        // El servidor explica el motivo con palabras pensadas para un cliente: mesa que no recibe
        // pedidos, tope alcanzado, producto que ya no está.
        toast.error(err.message);
      } else {
        toast.error('No se pudo enviar el pedido. Avisa a un mesero.');
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (menu.products.length === 0) {
    return (
      <>
        <QrBrandHeader business={menu.business} table={menu.table} />
        <Empty className="mt-8">
          <EmptyMedia variant="icon">
            <ShoppingBagIcon />
          </EmptyMedia>
          <EmptyTitle>No hay nada disponible ahora</EmptyTitle>
          <EmptyDescription>
            La carta cambia según la hora. Avisa a un mesero y te dirá qué hay.
          </EmptyDescription>
        </Empty>
      </>
    );
  }

  return (
    <>
      <QrBrandHeader business={menu.business} table={menu.table} />

      {!menu.table.acceptsOrders && (
        <p className="m-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
          Esta mesa no está recibiendo pedidos ahora mismo. Puedes ver la carta, y para pedir avisa a
          un mesero.
        </p>
      )}

      {menu.categories.length > 1 && (
        <nav
          aria-label="Categorías"
          className="flex gap-2 overflow-x-auto px-4 py-3"
        >
          <CategoryChip active={category === null} onClick={() => setCategory(null)}>
            Todo
          </CategoryChip>
          {menu.categories.map((c) => (
            <CategoryChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </CategoryChip>
          ))}
        </nav>
      )}

      {/*
       * Una columna en el teléfono y dos a partir de `md`.
       *
       * En una tableta la columna única no se «arreglaba» sola al ensanchar el contenedor: cada
       * tarjeta se estiraba hasta dejar el nombre pegado a la izquierda y el precio perdido a
       * setecientos píxeles, con el ojo teniendo que cruzar la pantalla para emparejarlos. Dos
       * columnas mantienen la tarjeta del tamaño para el que está pensada y llenan el hueco con
       * más carta visible, que es lo que interesa cuando alguien está eligiendo.
       *
       * `items-stretch` para que dos tarjetas de la misma fila midan igual aunque una tenga
       * descripción y la otra no. `pb-28` deja hueco para la barra fija del carrito.
       */}
      <ul className="grid grid-cols-1 items-stretch gap-2 px-4 pb-28 md:grid-cols-2">
        {visible.map((product) => (
          <li key={product.id} className="h-full">
            <button
              type="button"
              disabled={!menu.table.acceptsOrders}
              onClick={() => onProductTap(product)}
              className="flex h-full w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:bg-accent disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{product.name}</p>
                {product.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatPrice(Number(product.price))}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {count > 0 && (
        // `env(safe-area-inset-bottom)` para que la barra no quede debajo del indicador de inicio
        // de un teléfono sin botón físico.
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {/* Los mismos tramos que el contenedor del layout: la barra es fija y ocupa todo el
              ancho de la ventana, así que sin esto el botón quedaba centrado y desalineado con
              las tarjetas de arriba. */}
          <div className="mx-auto w-full max-w-md md:max-w-3xl lg:max-w-4xl">
            <Button className="h-14 w-full text-base" onClick={() => setCartOpen(true)}>
              <ShoppingBagIcon />
              Ver pedido ({count}) · {formatPrice(total)}
            </Button>
          </div>
        </div>
      )}

      <PublicModifierDialog
        product={chooseFor}
        open={chooseFor !== null}
        onOpenChange={(o) => !o && setChooseFor(null)}
        onConfirm={(ids) => chooseFor && add(chooseFor, ids)}
      />

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tu pedido</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-4">
            {cart.map((line) => (
              <div key={line.key} className="flex items-start gap-3 border-b pb-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.product.name}</p>
                  {line.modifierOptionIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {line.product.modifiers
                        .flatMap((m) => m.options)
                        .filter((o) => line.modifierOptionIds.includes(o.id))
                        .map((o) => o.name)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatPrice(line.unitTotal * line.quantity)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={`Quitar uno de ${line.product.name}`}
                    onClick={() => changeQuantity(line.key, -1)}
                  >
                    <MinusIcon />
                  </Button>
                  <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={`Añadir uno de ${line.product.name}`}
                    onClick={() => changeQuantity(line.key, 1)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </div>
            ))}

            <Field>
              <FieldLabel htmlFor="nombre">Tu nombre (opcional)</FieldLabel>
              <Input
                id="nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Para que sepan a quién traerlo"
                className="h-12"
              />
            </Field>

            <div className="flex items-baseline justify-between py-1 text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(total)}</span>
            </div>

            <Button
              className="h-14 w-full text-base"
              onClick={send}
              disabled={sending || !menu.table.acceptsOrders}
            >
              {sending && <Spinner />}
              Enviar pedido
            </Button>
            <p className="pb-4 text-center text-xs text-muted-foreground">
              El pedido va directo a la cocina. El pago se hace al final, con un mesero.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}
