'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/realtime/socket';

interface RealtimeContext {
  socket: Socket | null;
  /** Si el socket está conectado ahora mismo. */
  connected: boolean;
  /**
   * Cambia cada vez que el socket **recupera** la conexión tras haberla perdido. Sirve de
   * disparador para volver a pedir datos: quien lo escuche puede ponerlo en las dependencias
   * de un efecto y refrescar solo cuando de verdad hubo un corte.
   */
  reconnectedAt: number | null;
}

const SocketContext = createContext<RealtimeContext>({
  socket: null,
  connected: false,
  reconnectedAt: null,
});

/**
 * Conecta el socket mientras el árbol está montado. Se monta dentro del layout
 * del dashboard, que está autenticado en el servidor (redirige a /login si no
 * hay cookie válida), así que aquí siempre existe un access_token para el
 * handshake. Nunca se monta en /login.
 *
 * Además vigila la conexión. Antes nadie escuchaba `connect` ni `disconnect`: socket.io
 * reintentaba solo, pero al recuperar la red no se disparaba ningún refresco, así que la
 * pantalla seguía mostrando el mundo de antes del corte hasta que otro cliente provocara un
 * evento. Y como el gateway hace difusión pura, sin cursor ni búfer, todo lo emitido mientras
 * el dispositivo estuvo fuera se pierde: volver a pedir los datos es la única forma de
 * ponerse al día.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socket = getSocket();
  const [connected, setConnected] = useState(false);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);

  useEffect(() => {
    // Solo cuenta como reconexión si antes hubo una caída, para que la primera conexión de la
    // página no dispare un refresco redundante encima del render que acaba de llegar.
    let dropped = false;

    const onConnect = () => {
      setConnected(true);
      if (dropped) {
        dropped = false;
        setReconnectedAt(Date.now());
      }
    };
    const onDisconnect = () => {
      dropped = true;
      setConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, reconnectedAt }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): Socket | null {
  return useContext(SocketContext).socket;
}

/** Estado de la conexión en tiempo real, para avisos y para refrescar al reconectar. */
export function useRealtimeStatus(): Omit<RealtimeContext, 'socket'> {
  const { connected, reconnectedAt } = useContext(SocketContext);
  return { connected, reconnectedAt };
}
