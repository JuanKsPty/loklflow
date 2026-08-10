'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { putMany, replaceCollection, type Collection } from '@/lib/offline/cache';
import { pending as pendingOps } from '@/lib/offline/outbox';
import { useRealtimeStatus, useSocket } from './socket-provider';

interface OrderEvent {
  type: 'created' | 'item' | 'status';
  orderNumber?: number;
}

/**
 * Como `RealtimeRefresher`, pero para las pantallas que leen del dispositivo.
 *
 * La diferencia está en qué se hace al llegar un evento. `RealtimeRefresher` llama a
 * `router.refresh()`, que reejecuta el Server Component: **sin servidor eso falla**, y encima
 * resiembra la pantalla con el `initial` viejo que el cascarón trajo en su día. En una vista que
 * lee de la copia local es exactamente lo contrario de lo que hace falta.
 *
 * Aquí se vuelve a pedir en **cliente** y se escribe en la copia local. Con red, la pantalla se
 * actualiza igual que antes; sin ella, la petición falla, no se escribe nada, y la vista sigue
 * enseñando lo último que supo — que es todo el objetivo.
 *
 * Se conserva el rebote de 150 ms del original: una sola acción humana con seis pantallas
 * abiertas genera una ráfaga de eventos, y sin él serían seis peticiones por cada una.
 */
export function RealtimeInvalidator({
  events,
  collection,
  path,
  single = false,
  toastOnNewOrder = false,
}: {
  events: string[];
  collection: Collection;
  /** De dónde se vuelve a pedir. Mismo camino que usó el cascarón de servidor. */
  path: string;
  /**
   * Si `path` devuelve **una** fila en vez de la colección.
   *
   * Importa más de lo que parece: con la colección se borra de la copia local lo que ya no
   * viene, que es lo correcto en un listado —una cuenta cerrada en otro dispositivo tiene que
   * desaparecer— y desastroso en una ficha, donde borraría todas las demás.
   */
  single?: boolean;
  toastOnNewOrder?: boolean;
}) {
  const socket = useSocket();
  const { reconnectedAt } = useRealtimeStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await api.get<{ id: string } | { id: string }[]>(path);
      if (single) {
        await putMany(collection, [data as { id: string }]);
        return;
      }
      // Lo que tiene operaciones en cola sobrevive al reemplazo aunque el servidor no lo
      // conozca: una cuenta abierta sin conexión no está en su respuesta, y borrarla dejaría
      // a la cola enviando operaciones contra algo que la pantalla ya no muestra.
      const queued = await pendingOps();
      const protect = queued
        .map((op) => op.partition.split(':')[1])
        .filter((id): id is string => Boolean(id));
      await replaceCollection(collection, data as { id: string }[], { protect });
    } catch {
      // Sin red no hay nada que hacer y no hay nada que decir: la vista sigue con su copia
      // local, que es justo el comportamiento que se busca. El indicador de la cabecera ya
      // cuenta el estado de la conexión.
    }
  }, [collection, path, single]);

  // Al recuperar la conexión hay que volver a pedirlo todo: el gateway difunde sin cursor ni
  // búfer, así que lo ocurrido durante el corte no se reenvía nunca.
  useEffect(() => {
    if (reconnectedAt !== null) void reload();
  }, [reconnectedAt, reload]);

  useEffect(() => {
    if (!socket) return;

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void reload(), 150);
    };

    const handlers = events.map((event) => {
      const handler = (payload?: OrderEvent) => {
        if (toastOnNewOrder && payload?.type === 'created') {
          toast.info(`Nueva orden #${payload.orderNumber ?? ''}`.trim());
        }
        schedule();
      };
      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      handlers.forEach(({ event, handler }) => socket.off(event, handler));
    };
  }, [socket, events, toastOnNewOrder, reload]);

  return null;
}
