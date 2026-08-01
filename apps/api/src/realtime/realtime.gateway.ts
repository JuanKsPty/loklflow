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
import { LogThrottle } from '../common/logging/log-throttle';

const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') ?? [
  'http://localhost:3000',
];

/**
 * Traduce el fallo de `jwt.verify` a algo accionable.
 *
 * Se mira `name` y no `instanceof TokenExpiredError` a propósito: `jsonwebtoken` no es una
 * dependencia directa de este paquete —llega a través de `@nestjs/jwt`— y con pnpm importarla
 * desde aquí depende de un enlace que puede no existir.
 *
 * La diferencia importa: un token caducado es el día a día de una tablet que lleva horas
 * encendida; un token inválido, con el mismo secreto, señala otra cosa (otro despliegue, otro
 * secreto, alguien probando).
 */
function reasonFor(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'TokenExpiredError') return 'token caducado';
  if (name === 'JsonWebTokenError') return 'token inválido';
  return 'no se pudo verificar el token';
}

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

export interface NotificationEvent {
  title: string;
}

export interface ShiftEvent {
  userId: string;
}

@WebSocketGateway({ cors: { origin: CORS_ORIGINS, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  /**
   * El socket rechazado se reconecta solo, cada pocos segundos y para siempre. Sin freno,
   * una tablet olvidada encendida con el token caducado escribe decenas de miles de líneas
   * idénticas por noche y entierra cualquier otra cosa.
   */
  private readonly rejections = new LogThrottle();

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(socket: Socket) {
    const token = this.tokenFromHandshake(socket);
    if (!token) return this.reject(socket, 'sin token');

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      socket.data.user = payload;
      const perms = payload.permissions ?? [];
      if (perms.includes('orders:read')) void socket.join('orders');
      if (perms.includes('tables:read')) void socket.join('tables');
      // Salas personales para notificaciones dirigidas.
      if (payload.sub) void socket.join(`user:${payload.sub}`);
      if (payload.roleName) void socket.join(`role:${payload.roleName}`);
    } catch (err) {
      this.reject(socket, reasonFor(err));
    }
  }

  /**
   * Cierra la conexión dejando constancia de **por qué**.
   *
   * Antes este camino era mudo —el `logger` estaba declarado y no se usaba en ninguna línea—,
   * así que un token caducado y un secreto mal configurado se veían igual desde fuera: la
   * pantalla simplemente no se actualiza y no hay nada que mirar.
   */
  private reject(socket: Socket, reason: string): void {
    const origin = socket.handshake.address || 'origen desconocido';
    const { log, suppressed } = this.rejections.check(`${origin}|${reason}`);
    if (log) {
      this.logger.warn({
        event: 'ws:rejected',
        reason,
        origin,
        ...(suppressed ? { suppressed } : {}),
      });
    }
    socket.disconnect();
  }

  emitOrder(payload: OrderEvent) {
    this.server.to('orders').emit('order:changed', payload);
  }

  emitTable(payload: TableEvent) {
    this.server.to('tables').emit('table:changed', payload);
  }

  pushToUser(userId: string, payload: NotificationEvent) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  pushToRole(roleName: string, payload: NotificationEvent) {
    this.server.to(`role:${roleName}`).emit('notification:new', payload);
  }

  /** Avisa al propio cobrador que su turno de caja cambió (abrir/cerrar). */
  emitShift(userId: string) {
    this.server.to(`user:${userId}`).emit('shift:changed', { userId } satisfies ShiftEvent);
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
