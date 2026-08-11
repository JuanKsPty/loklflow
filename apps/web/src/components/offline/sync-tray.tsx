'use client';

import { useState } from 'react';
import { AlertTriangleIcon, ClockIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { OperationKind } from '@/lib/offline/queueable';
import { discard, requeuePartition, type QueuedOperation } from '@/lib/offline/outbox';
import { useFailedOperations, usePendingOperations } from '@/lib/offline/use-outbox';
import { useConnectivity } from './offline-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Lo que la cola tiene sin enviar, y qué se puede hacer con ello.
 *
 * Es un `Sheet` y no una ruta a propósito: así existe igual en mesero, cocina y caja sin
 * inventar tres pantallas, sin tocar `proxy.ts`, y sin sacar al operario de lo que estaba
 * haciendo — que en una caja es media venta.
 *
 * Se agrupa **por cuenta** y no por operación porque es como piensa quien lo va a leer: nadie
 * quiere reintentar «PATCH /orders/…/items/…», quiere reintentar la mesa 4. Y porque el orden
 * dentro de una cuenta importa: reintentar una sola operación cuyas anteriores siguen
 * fallando la manda contra el mismo muro.
 */

const LABELS: Record<OperationKind, string> = {
  'order.create': 'Abrir cuenta',
  'order.addItem': 'Añadir producto',
  'order.updateItem': 'Cambiar cantidad',
  'order.removeItem': 'Quitar producto',
  'order.status': 'Cambiar estado de la comanda',
  'orderItem.status': 'Cambiar estado de un producto',
  'table.status': 'Cambiar estado de la mesa',
  'payment.add': 'Cobro',
  'order.tip': 'Propina',
  'discount.request': 'Descuento',
  'shift.open': 'Abrir turno',
  'shift.close': 'Cerrar turno',
};

function describe(kind: OperationKind): string {
  return LABELS[kind] ?? kind;
}

/** `order:<id>` → «Cuenta …abc123». No hay número de orden hasta que el servidor lo asigna. */
function describePartition(partition: string): string {
  const [type, id = ''] = partition.split(':');
  if (type === 'table') return `Mesa ${id.slice(0, 6)}`;
  return `Cuenta ${id.slice(0, 6)}`;
}

function age(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h`;
}

function groupByPartition(ops: QueuedOperation[]): [string, QueuedOperation[]][] {
  const groups = new Map<string, QueuedOperation[]>();
  for (const op of ops) {
    groups.set(op.partition, [...(groups.get(op.partition) ?? []), op]);
  }
  return [...groups.entries()];
}

export function SyncTray({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pending = usePendingOperations();
  const stuck = useFailedOperations();
  const { online, syncing, needsAuth, flushNow } = useConnectivity();
  const [toDiscard, setToDiscard] = useState<QueuedOperation | null>(null);

  async function retry(partition: string) {
    const moved = await requeuePartition(partition);
    await flushNow();
    toast.success(`${moved} ${moved === 1 ? 'operación devuelta' : 'operaciones devueltas'} a la cola`);
  }

  async function confirmDiscard() {
    if (!toDiscard) return;
    await discard(toDiscard.seq);
    setToDiscard(null);
    toast.success('Operación descartada');
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Sincronización</SheetTitle>
            <SheetDescription>
              {online
                ? 'Hay conexión con el servidor.'
                : 'Sin conexión. Lo que hagas se guarda aquí y se envía solo al volver.'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {needsAuth && (
              <p className="mb-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                La sesión caducó. Vuelve a iniciar sesión para enviar lo que queda pendiente;
                no se ha perdido nada.
              </p>
            )}

            {pending.length === 0 && stuck.length === 0 && (
              <Empty>
                <EmptyMedia variant="icon">
                  <ClockIcon />
                </EmptyMedia>
                <EmptyTitle>Todo enviado</EmptyTitle>
                <EmptyDescription>No queda nada por sincronizar.</EmptyDescription>
              </Empty>
            )}

            {pending.length > 0 && (
              <section className="py-2">
                <h3 className="mb-2 text-sm font-semibold">
                  Pendientes de enviar
                  <Badge variant="secondary" className="ml-2">
                    {pending.length}
                  </Badge>
                </h3>
                {groupByPartition(pending).map(([partition, ops]) => (
                  <div key={partition} className="mb-3 rounded-md border p-3">
                    <p className="text-sm font-medium">{describePartition(partition)}</p>
                    <ul className="mt-1 space-y-1">
                      {ops.map((op) => (
                        <li key={op.seq} className="text-xs text-muted-foreground">
                          {describe(op.kind)} · {age(op.createdAt)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {stuck.length > 0 && (
              <section className="py-2">
                {pending.length > 0 && <Separator className="mb-4" />}
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangleIcon className="size-4" />
                  Sin enviar
                  <Badge variant="destructive">{stuck.length}</Badge>
                </h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  El servidor rechazó estas operaciones. No se han perdido: decide tú si se
                  reintentan o se descartan.
                </p>
                {groupByPartition(stuck).map(([partition, ops]) => (
                  <div key={partition} className="mb-3 rounded-md border border-destructive/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{describePartition(partition)}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retry(partition)}
                        disabled={syncing}
                      >
                        <RefreshCwIcon />
                        Reintentar
                      </Button>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {ops.map((op) => (
                        <li key={op.seq} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{describe(op.kind)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {op.lastError ?? 'Sin detalle del servidor'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Descartar"
                            onClick={() => setToDiscard(op)}
                          >
                            <Trash2Icon />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}
          </div>

          <div className="border-t p-4">
            <Button className="w-full" onClick={() => flushNow()} disabled={syncing}>
              <RefreshCwIcon className={syncing ? 'animate-spin' : undefined} />
              {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmación aparte, y nombrando lo que se tira: descartar es la única acción de esta
          pantalla que destruye trabajo del salón. */}
      <AlertDialog open={toDiscard !== null} onOpenChange={(o) => !o && setToDiscard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar «{toDiscard && describe(toDiscard.kind)}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Es de {toDiscard && describePartition(toDiscard.partition).toLowerCase()}, de{' '}
              {toDiscard && age(toDiscard.createdAt)}. No se enviará nunca y no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDiscard}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
