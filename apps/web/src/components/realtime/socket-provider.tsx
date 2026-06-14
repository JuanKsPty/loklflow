'use client';

import { createContext, useContext, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/realtime/socket';

const SocketContext = createContext<Socket | null>(null);

/**
 * Conecta el socket mientras el árbol está montado. Se monta dentro del layout
 * del dashboard, que está autenticado en el servidor (redirige a /login si no
 * hay cookie válida), así que aquí siempre existe un access_token para el
 * handshake. Nunca se monta en /login.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socket = getSocket();

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
