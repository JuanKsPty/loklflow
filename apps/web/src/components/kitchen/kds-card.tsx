'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Order, OrderStatus } from '@loklflow/types';
import { ordersApi } from '@/lib/api/orders.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';
import { ElapsedTime } from './elapsed-time';

// Acción de avance primaria por estado (avance por orden).
const ADVANCE: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  pending: { label: 'Comenzar', next: 'preparing' },
  preparing: { label: 'Marcar lista', next: 'ready' },
  ready: { label: 'Marcar entregada', next: 'delivered' },
};

export function KdsCard({ order }: { order: Order }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const advance = ADVANCE[order.status];
  // En cocina solo se muestran (y preparan) los ítems de estación cocina.
  const kitchenItems = (order.items ?? []).filter((i) => i.product?.station === 'kitchen');

  async function run(next: OrderStatus, okMsg: string) {
    setBusy(true);
    try {
      await ordersApi.updateStatus(order.id, { status: next });
      toast.success(okMsg);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="leading-tight">
            <p className="text-base font-bold">
              #{order.orderNumber}
              {order.label && <span className="ml-1.5 text-sm font-medium text-muted-foreground">· {order.label}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.table ? `Mesa ${order.table.number}` : 'Para llevar'}
            </p>
          </div>
          <ElapsedTime since={order.createdAt} />
        </div>

        <ul className="flex flex-col gap-1.5 border-t pt-2 text-sm">
          {kitchenItems.map((item) => (
            <li key={item.id}>
              <span className="font-medium">
                {item.quantity}× {item.product?.name ?? 'Producto'}
              </span>
              {(item.modifiers ?? []).length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({(item.modifiers ?? []).length} mod.)
                </span>
              )}
              {item.notes && <p className="text-xs italic text-muted-foreground">{item.notes}</p>}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {advance && (
            <Button
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => run(advance.next, `Orden ${ORDER_STATUS_LABELS[advance.next].toLowerCase()}`)}
            >
              {busy && <Spinner />}
              {advance.label}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={busy}
            onClick={() => run('cancelled', 'Orden cancelada')}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
