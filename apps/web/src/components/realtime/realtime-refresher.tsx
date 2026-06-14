'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSocket } from './socket-provider';

interface OrderEvent {
  type: 'created' | 'item' | 'status';
  orderNumber?: number;
}

/**
 * Refresca la página (server component) cuando llega un evento de tiempo real
 * provocado por OTRO cliente. Las mutaciones locales ya hacen router.refresh();
 * el debounce evita refrescos dobles ante ráfagas.
 */
export function RealtimeRefresher({
  events,
  toastOnNewOrder = false,
}: {
  events: string[];
  toastOnNewOrder?: boolean;
}) {
  const socket = useSocket();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket) return;

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 150);
    };

    const handlers = events.map((event) => {
      const handler = (payload?: OrderEvent) => {
        if (toastOnNewOrder && payload?.type === 'created') {
          toast.info(`Nueva orden #${payload.orderNumber ?? ''}`.trim());
        }
        scheduleRefresh();
      };
      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      handlers.forEach(({ event, handler }) => socket.off(event, handler));
    };
  }, [socket, router, events, toastOnNewOrder]);

  return null;
}
