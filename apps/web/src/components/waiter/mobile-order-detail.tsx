'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusIcon } from 'lucide-react';
import type {
  Order,
  OrderItemStatus,
  OrderStatus,
  Product,
} from '@loklflow/types';
import { ORDER_ITEM_STATUSES, PREPARATION_STATION_LABELS } from '@loklflow/types';
import { CreditCardIcon } from 'lucide-react';
import { CheckoutPanel } from '@/components/pos/checkout-panel';
import { ordersApi } from '@/lib/api/orders.api';
import { formatPrice } from '@/lib/format';
import {
  ALLOWED_TRANSITIONS,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABELS,
} from '@/components/admin/orders/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  order: Order;
  products: Product[];
}

export function MobileOrderDetail({ order, products }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const open = order.status !== 'closed' && order.status !== 'cancelled';

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  const nextStates = ALLOWED_TRANSITIONS[order.status];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{order.label || `Orden #${order.orderNumber}`}</h1>
          <p className="text-sm text-muted-foreground">
            {order.label && `#${order.orderNumber} · `}
            {order.table ? `Mesa ${order.table.number}` : 'Para llevar'}
          </p>
        </div>
        <Badge variant="outline" className={ORDER_STATUS_BADGE[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {nextStates.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {nextStates.map((s: OrderStatus) => (
            <Button
              key={s}
              size="lg"
              variant={s === 'cancelled' ? 'outline' : 'default'}
              disabled={busy}
              onClick={() =>
                run(
                  () => ordersApi.updateStatus(order.id, { status: s }),
                  `Orden ${ORDER_STATUS_LABELS[s].toLowerCase()}`,
                )
              }
            >
              {s === 'cancelled' ? 'Cancelar' : ORDER_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      )}

      {open && order.total > 0 && <CobrarDialog order={order} onSettled={() => router.refresh()} />}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Ítems</span>
          {open && <AddItemDialog order={order} products={products} onDone={() => router.refresh()} />}
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            {(order.items ?? []).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {item.quantity}× {item.product?.name ?? 'Producto'}
                    {item.product?.station && item.product.station !== 'kitchen' && (
                      <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                        {PREPARATION_STATION_LABELS[item.product.station]}
                      </Badge>
                    )}
                  </p>
                  {(item.modifiers ?? []).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {(item.modifiers ?? []).length} modificador(es)
                    </p>
                  )}
                  {item.notes && <p className="text-xs italic text-muted-foreground">{item.notes}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{formatPrice(item.subtotal)}</p>
                </div>
                <Select
                  items={ORDER_ITEM_STATUSES.map((s) => ({ value: s, label: ORDER_ITEM_STATUS_LABELS[s] }))}
                  value={item.status}
                  onValueChange={(v) =>
                    run(
                      () => ordersApi.updateItemStatus(order.id, item.id, { status: (v as OrderItemStatus) ?? 'pending' }),
                      'Ítem actualizado',
                    )
                  }
                >
                  <SelectTrigger size="sm" className="w-32 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_ITEM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ORDER_ITEM_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(order.total)}</span>
        </div>
      </div>
    </div>
  );
}

function AddItemDialog({
  order,
  products,
  onDone,
}: {
  order: Order;
  products: Product[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!productId) {
      toast.error('Selecciona un producto');
      return;
    }
    setSubmitting(true);
    try {
      await ordersApi.addItem(order.id, { productId, quantity });
      toast.success('Ítem agregado');
      setOpen(false);
      setProductId('');
      setQuantity(1);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al agregar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PlusIcon />
            Agregar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar ítem</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Producto</FieldLabel>
            <Select
              items={products.map((p) => ({ value: p.id, label: p.name }))}
              value={productId || null}
              onValueChange={(v) => setProductId(v ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {formatPrice(p.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="max-w-28">
            <FieldLabel htmlFor="add-qty">Cantidad</FieldLabel>
            <Input
              id="add-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={handleAdd} disabled={submitting}>
            {submitting && <Spinner />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CobrarDialog({ order, onSettled }: { order: Order; onSettled: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="w-full">
            <CreditCardIcon />
            Cobrar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar {order.label || `Orden #${order.orderNumber}`}</DialogTitle>
        </DialogHeader>
        <CheckoutPanel
          order={order}
          onSettled={() => {
            setOpen(false);
            onSettled();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
