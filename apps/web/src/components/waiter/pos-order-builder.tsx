'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MinusIcon, PlusIcon, Trash2Icon, SendIcon } from 'lucide-react';
import type { Category, Modifier, Product } from '@loklflow/types';
import { ordersApi } from '@/lib/api/orders.api';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CartLine {
  key: string;
  productId: string;
  name: string;
  unitTotal: number; // precio + ajustes de modificadores (por unidad)
  quantity: number;
  modifierOptionIds: string[];
  modifierLabel: string;
}

interface Props {
  tableId?: string;
  categories: Category[];
  products: Product[];
  modifiers: Modifier[];
}

export function PosOrderBuilder({ tableId, categories, products, modifiers }: Props) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string>('all');
  const [label, setLabel] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  const modifierById = useMemo(() => new Map(modifiers.map((m) => [m.id, m])), [modifiers]);
  const optionById = useMemo(() => {
    const map = new Map<string, { name: string; priceAdjustment: number }>();
    for (const m of modifiers) {
      for (const o of m.options ?? []) map.set(o.id, { name: o.name, priceAdjustment: Number(o.priceAdjustment) });
    }
    return map;
  }, [modifiers]);

  const visibleProducts = products.filter((p) => activeCat === 'all' || p.categoryId === activeCat);

  function modifiersForProduct(product: Product): Modifier[] {
    if (!product.modifiers) return [];
    return product.modifiers
      .map((m) => modifierById.get(m.id))
      .filter((m): m is Modifier => Boolean(m));
  }

  function addLine(product: Product, optionIds: string[]) {
    const adjustments = optionIds.reduce((sum, id) => sum + (optionById.get(id)?.priceAdjustment ?? 0), 0);
    const unitTotal = Number((Number(product.price) + adjustments).toFixed(2));
    const modifierLabel = optionIds.map((id) => optionById.get(id)?.name).filter(Boolean).join(', ');

    setCart((prev) => {
      // Sin modificadores: si ya existe una línea del mismo producto, incrementa.
      if (optionIds.length === 0) {
        const idx = prev.findIndex((l) => l.productId === product.id && l.modifierOptionIds.length === 0);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
      }
      return [
        ...prev,
        {
          key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          productId: product.id,
          name: product.name,
          unitTotal,
          quantity: 1,
          modifierOptionIds: optionIds,
          modifierLabel,
        },
      ];
    });
  }

  function onProductTap(product: Product) {
    if (modifiersForProduct(product).length > 0) setModalProduct(product);
    else addLine(product, []);
  }

  function setQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitTotal * l.quantity, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  async function submit() {
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    setSubmitting(true);
    try {
      const order = await ordersApi.create({
        ...(tableId ? { tableId } : {}),
        ...(label.trim() ? { label: label.trim() } : {}),
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          ...(l.modifierOptionIds.length ? { modifierOptionIds: l.modifierOptionIds } : {}),
        })),
      });
      toast.success(`Cuenta #${order.orderNumber} enviada`);
      router.push(`/waiter/orden/${order.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar la cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
      {/* Catálogo */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          <CatChip label="Todos" active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
          {categories.map((c) => (
            <CatChip key={c.id} label={c.name} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onProductTap(p)}
              className="flex flex-col rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent active:scale-95"
            >
              <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
              <span className="mt-auto pt-2 text-sm font-semibold text-primary">{formatPrice(p.price)}</span>
            </button>
          ))}
          {visibleProducts.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Sin productos.</p>
          )}
        </div>
      </div>

      {/* Cuenta */}
      <div className="flex min-h-0 shrink-0 flex-col rounded-xl border lg:w-80">
        <div className="border-b p-3">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre de la cuenta (opcional)"
            maxLength={80}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Toca productos para agregarlos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cart.map((l) => (
                <li key={l.key} className="rounded-lg border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.name}</p>
                      {l.modifierLabel && (
                        <p className="text-xs text-muted-foreground">{l.modifierLabel}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatPrice(l.unitTotal)} c/u</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatPrice(l.unitTotal * l.quantity)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setQty(l.key, -1)} aria-label="Menos">
                      <MinusIcon />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">{l.quantity}</span>
                    <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setQty(l.key, 1)} aria-label="Más">
                      <PlusIcon />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="ml-auto size-7 text-muted-foreground" onClick={() => removeLine(l.key)} aria-label="Quitar">
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t p-3">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({itemCount})</span>
            <span className="font-semibold tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          <Button type="button" size="lg" className="w-full" disabled={submitting || cart.length === 0} onClick={submit}>
            {submitting ? <Spinner /> : <SendIcon />}
            Enviar cuenta
          </Button>
        </div>
      </div>

      {modalProduct && (
        <ModifierDialog
          product={modalProduct}
          groups={modifiersForProduct(modalProduct)}
          onClose={() => setModalProduct(null)}
          onConfirm={(optionIds) => {
            addLine(modalProduct, optionIds);
            setModalProduct(null);
          }}
        />
      )}
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {label}
    </button>
  );
}

function ModifierDialog({
  product,
  groups,
  onClose,
  onConfirm,
}: {
  product: Product;
  groups: Modifier[];
  onClose: () => void;
  onConfirm: (optionIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.id}>
              <p className="mb-1.5 text-sm font-medium">{g.name}</p>
              <div className="flex flex-col gap-1.5">
                {(g.options ?? []).map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox checked={selected.includes(opt.id)} onCheckedChange={() => toggle(opt.id)} />
                    <span className="flex-1">{opt.name}</span>
                    {Number(opt.priceAdjustment) > 0 && (
                      <span className="text-xs text-muted-foreground">+{formatPrice(opt.priceAdjustment)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={() => onConfirm(selected)}>Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
