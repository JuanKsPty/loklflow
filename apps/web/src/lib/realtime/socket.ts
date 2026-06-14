import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Devuelve el socket singleton. La autenticación viaja en la cookie httpOnly
 * `access_token` gracias a `withCredentials` (el handshake usa XHR), igual que
 * el cliente HTTP en lib/api/client.ts. No se conecta hasta llamar connect().
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, { withCredentials: true, autoConnect: false });
  }
  return socket;
}
