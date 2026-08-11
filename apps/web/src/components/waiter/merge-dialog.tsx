'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Order, RestaurantTable } from '@loklflow/types';
import { ordersApi } from '@/lib/api/orders.api';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CLOSED = new Set(['closed', 'cancelled']);
const MONEY_EPSILON = 0.001;

/** Por qué una cuenta no se puede fusionar, con las mismas reglas que aplica el servidor. */
function blockedReason(order: Order): string | null {
  const paid = (order.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  if (paid > MONEY_EPSILON) return 'ya tiene pagos';
  if (Number(order.discountAmount) > MONEY_EPSILON) return 'tiene descuento';
  if (Number(order.tipAmount) > MONEY_EPSILON) return 'tiene propina';
  return null;
}

/**
 * Elegir qué cuenta manda y confirmar la fusión.
 *
 * Las razones por las que una cuenta no se puede fusionar se pintan aquí, pero **la regla vive en
 * el servidor** (`canMerge`): esto solo evita que el mesero descubra el problema después de elegir.
 * Si las dos se separaran, la de aquí sería la que estaría mal, y por eso el mensaje de error que
 * se enseña al fallar es el del servidor y no uno propio.
 */
export function MergeDialog({
  open,
  onOpenChange,
  tables,
  orders,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Las mesas seleccionadas, en orden de selección. */
  tables: RestaurantTable[];
  /** Todas las cuentas conocidas; aquí se filtran las de estas mesas. */
  orders: Order[];
  onDone: () => void;
}) {
  const router = useRouter();
  // Lo que el mesero haya elegido explícitamente. El valor efectivo se **deriva**: sin esto haría
  // falta un efecto que sembrara el estado al abrir, y ese efecto se volvería a disparar cada vez
  // que cambiara la lista de cuentas, pisando la elección del mesero mientras la mira.
  const [override, setOverride] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tableIds = new Set(tables.map((t) => t.id));
  const candidates = orders
    .filter((o) => o.tableId && tableIds.has(o.tableId) && !CLOSED.has(o.status))
    .filter((o) => !o.mergedIntoOrderId)
    .sort((a, b) => a.orderNumber - b.orderNumber);

  // La primera cuenta seleccionable es la principal por defecto: es la elección más común y
  // ahorra un toque en el 90 % de los casos.
  const firstFree = candidates.find((o) => blockedReason(o) === null)?.id ?? null;
  const targetId = override ?? firstFree;

  // Solo se manda lo que de verdad se puede fusionar: el servidor rechazaría el lote entero por
  // una cuenta con pagos, y el mesero perdería también las que sí valían.
  const sources = candidates.filter((o) => o.id !== targetId && blockedReason(o) === null);
  const blocked = candidates.filter((o) => o.id !== targetId && blockedReason(o) !== null);
  const mergedTotal = [...sources, ...candidates.filter((o) => o.id === targetId)].reduce(
    (sum, o) => sum + Number(o.total),
    0,
  );

  async function confirm() {
    if (!targetId || sources.length === 0) return;
    setBusy(true);
    try {
      await ordersApi.merge(
        targetId,
        sources.map((o) => o.id),
      );
      toast.success(`${sources.length + 1} cuentas fusionadas`);
      onOpenChange(false);
      onDone();
      router.refresh();
    } catch (err) {
      // El mensaje del servidor nombra la cuenta concreta y el motivo.
      toast.error(err instanceof Error ? err.message : 'No se pudo fusionar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Al cerrar se olvida la elección: la próxima vez son otras mesas.
        if (!next) setOverride(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fusionar cuentas</DialogTitle>
          <DialogDescription>
            Todo pasa a la cuenta principal y se cobra junto. Las mesas que se queden sin cuenta
            se liberan.
          </DialogDescription>
        </DialogHeader>

        {candidates.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Hacen falta al menos dos cuentas abiertas entre las mesas elegidas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">¿Cuál es la cuenta principal?</p>
            {candidates.map((order) => {
              const reason = blockedReason(order);
              const isTarget = order.id === targetId;
              return (
                <label
                  key={order.id}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2',
                    isTarget && 'border-primary bg-primary/5',
                    reason && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="target"
                    className="size-4"
                    checked={isTarget}
                    disabled={reason !== null}
                    onChange={() => setOverride(order.id)}
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    {order.label || `Cuenta #${order.orderNumber}`}
                    {order.table && (
                      <span className="text-muted-foreground"> · Mesa {order.table.number}</span>
                    )}
                    {reason && <span className="block text-xs text-destructive">{reason}</span>}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatPrice(Number(order.total))}
                  </span>
                </label>
              );
            })}

            {blocked.length > 0 && (
              <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                {blocked.length === 1 ? 'Una cuenta' : `${blocked.length} cuentas`} no se pueden
                fusionar y se quedarán aparte. Cóbralas por separado.
              </p>
            )}

            <div className="mt-1 flex items-baseline justify-between font-medium">
              <span>Total fusionado</span>
              <span className="tabular-nums">{formatPrice(mergedTotal)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={confirm}
            disabled={busy || !targetId || sources.length === 0}
          >
            {busy && <Spinner />}
            Fusionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
