'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { CheckCircle2Icon, ChefHatIcon, ClockIcon, UtensilsIcon } from 'lucide-react';
import type { PublicOrderStatus } from '@loklflow/types';
import { guestTokenStore, publicApi } from '@/lib/api/public.api';
import { ApiError } from '@/lib/api/client';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** Los pasos que el cliente entiende. `delivered` y `closed` colapsan en «servido». */
const STEPS = [
  { key: 'pending', label: 'Recibido', icon: ClockIcon },
  { key: 'preparing', label: 'En preparación', icon: ChefHatIcon },
  { key: 'ready', label: 'Listo', icon: UtensilsIcon },
  { key: 'served', label: 'Servido', icon: CheckCircle2Icon },
] as const;

function stepIndex(status: string): number {
  if (status === 'delivered' || status === 'closed') return 3;
  const found = STEPS.findIndex((s) => s.key === status);
  return found === -1 ? 0 : found;
}

/**
 * El estado del pedido de un cliente.
 *
 * **Por sondeo y no por WebSocket**, y no es pereza: el gateway de tiempo real rechaza cualquier
 * handshake sin `access_token`, así que un cliente anónimo tendría que abrir una sala nueva con su
 * propio modelo de autorización y su propia gestión de rechazos —`LogThrottle` recogería los de cada
 * teléfono que se aleja del WiFi— para un estado que cambia tres veces por comida. Diez segundos son
 * seis peticiones por minuto contra un endpoint que devuelve un objeto pequeño.
 *
 * El sondeo se **para** con la pestaña oculta. Un teléfono en un bolsillo no necesita saberlo, y en
 * una mesa de seis eso son seis teléfonos preguntando cada diez segundos para nada.
 */
export function PublicOrderTracker({ qrCode }: { qrCode: string }) {
  // El pase se lee como lo que es —una fuente externa al render— para que no haya que sembrarlo en
  // un efecto: en el servidor no existe `sessionStorage`.
  const token = useSyncExternalStore(
    guestTokenStore.subscribe,
    guestTokenStore.read,
    guestTokenStore.readOnServer,
  );

  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [fetchState, setFetchState] = useState<'loading' | 'ok' | 'expired' | 'error'>('loading');

  // Sin pase no hay nada que pedir, y eso se **deriva**: no es un estado que alguien tenga que
  // recordar poner.
  const state = token === null ? 'no-token' : fetchState;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrder(await publicApi.myOrder(token));
      setFetchState('ok');
    } catch (err) {
      // 401 es un pase caducado —han pasado cuatro horas— y se cuenta distinto de un fallo de red:
      // el primero no se arregla esperando.
      if (err instanceof ApiError && err.status === 401) setFetchState('expired');
      else setFetchState((prev) => (prev === 'ok' ? 'ok' : 'error'));
    }
  }, [token]);

  useEffect(() => {
    /**
     * La regla marca cualquier llamada que acabe en `setState`, sin distinguir si ocurre antes o
     * después de un `await`. Aquí ocurre después: lo primero que hace `load` es esperar la
     * petición, así que no hay ningún render en cascada — es un falso positivo.
     *
     * Se silencia en el punto exacto y con el motivo escrito, en vez de retorcer el código con un
     * `Promise.resolve().then(load)` que hace lo mismo y se lee peor.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 10_000);
    return () => clearInterval(timer);
  }, [load]);

  // Al volver a mirar el teléfono, no esperar hasta el siguiente tic.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (state === 'no-token' || state === 'expired') {
    return (
      <Empty className="mt-10">
        <EmptyMedia variant="icon">
          <ClockIcon />
        </EmptyMedia>
        <EmptyTitle>
          {state === 'expired' ? 'Este seguimiento ha caducado' : 'No hay ningún pedido aquí'}
        </EmptyTitle>
        <EmptyDescription>
          {state === 'expired'
            ? 'Por seguridad el seguimiento dura unas horas. Tu pedido sigue en la cocina: pregunta a un mesero.'
            : 'Haz un pedido desde la carta y podrás seguirlo desde aquí.'}
        </EmptyDescription>
        <Button className="mt-2 h-12" nativeButton={false} render={<Link href={`/m/${qrCode}`} />}>
          Ver la carta
        </Button>
      </Empty>
    );
  }

  if (!order) {
    return (
      <Empty className="mt-10">
        <EmptyTitle>No se pudo cargar tu pedido</EmptyTitle>
        <EmptyDescription>Comprueba tu conexión, o pregunta a un mesero.</EmptyDescription>
      </Empty>
    );
  }

  const current = stepIndex(order.status);
  const cancelled = order.status === 'cancelled';

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <header className="text-center">
        <p className="text-sm text-muted-foreground">Pedido #{order.orderNumber}</p>
        <h1 className="text-xl font-semibold">
          {cancelled ? 'Pedido cancelado' : STEPS[current].label}
        </h1>
        {order.tableNumber !== null && (
          <p className="text-sm text-muted-foreground">Mesa {order.tableNumber}</p>
        )}
      </header>

      {cancelled ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-center text-sm text-destructive">
          Este pedido se canceló. Si no lo pediste tú, avisa a un mesero.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const done = i <= current;
            return (
              <li
                key={step.key}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-3',
                  done ? 'border-primary/30 bg-primary/5' : 'opacity-50',
                )}
              >
                <Icon className={cn('size-5 shrink-0', done && 'text-primary')} />
                <span className={cn('text-sm', done && 'font-medium')}>{step.label}</span>
                {i === current && !cancelled && <Spinner className="ml-auto size-4" />}
              </li>
            );
          })}
        </ol>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Lo que pediste</h2>
        <ul className="rounded-xl border text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-2 border-b px-3 py-2 last:border-0">
              <div className="min-w-0">
                <span>
                  {item.quantity}× {item.name}
                </span>
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-muted-foreground">{item.modifiers.join(' · ')}</p>
                )}
                {item.notes && <p className="text-xs italic text-muted-foreground">{item.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(order.total)}</span>
        </div>
        {/* Se dice explícitamente porque es la duda inmediata de cualquiera que acaba de pedir
            desde su teléfono: si ya pagó o no. */}
        <p className="mt-1 text-xs text-muted-foreground">
          El pago se hace al final, con un mesero. Todavía no has pagado nada.
        </p>
      </section>

      <Button
        variant="outline"
        className="h-12"
        nativeButton={false}
        render={<Link href={`/m/${qrCode}`} />}
      >
        Pedir algo más
      </Button>
    </div>
  );
}
