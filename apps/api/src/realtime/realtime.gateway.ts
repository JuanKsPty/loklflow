import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') ?? [
  'http://localhost:3000',
];

export interface OrderEvent {
  type: 'created' | 'item' | 'status';
  orderId: string;
  orderNumber?: number;
  tableId?: string | null;
  status?: string;
}

export interface TableEvent {
  type: 'status' | 'update' | 'layout';
  tableId?: string;
  status?: string;
}

@WebSocketGateway({ cors: { origin: CORS_ORIGINS, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(socket: Socket) {
    const token = this.tokenFromHandshake(socket);
    if (!token) return socket.disconnect();

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      socket.data.user = payload;
      const perms = payload.permissions ?? [];
      if (perms.includes('orders:read')) void socket.join('orders');
      if (perms.includes('tables:read')) void socket.join('tables');
    } catch {
      socket.disconnect();
    }
  }

  emitOrder(payload: OrderEvent) {
    this.server.to('orders').emit('order:changed', payload);
  }

  emitTable(payload: TableEvent) {
    this.server.to('tables').emit('table:changed', payload);
  }

  /** Extrae el access_token de la cookie del handshake (httpOnly) o del header Bearer. */
  private tokenFromHandshake(socket: Socket): string | null {
    const cookieHeader = socket.handshake.headers.cookie;
    if (cookieHeader) {
      for (const part of cookieHeader.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name === 'access_token') return decodeURIComponent(rest.join('='));
      }
    }
    const auth = socket.handshake.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
