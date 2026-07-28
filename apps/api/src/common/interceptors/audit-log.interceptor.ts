import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_KEY, type AuditMeta } from '../decorators/audit.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface AuditableRequest {
  user?: JwtPayload;
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
  socket?: { remoteAddress?: string };
}

/**
 * IP del cliente. Limitación conocida: main.ts no configura `trust proxy`, así que tras
 * un ingress esto daría la IP del proxy salvo que llegue por x-forwarded-for. Se
 * resolverá al preparar el deploy.
 */
export function resolveIp(request: AuditableRequest): string | undefined {
  return request.ip ?? request.socket?.remoteAddress ?? undefined;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // getAllAndOverride con [handler, class], igual que PermissionsGuard: así un
    // @Audit() a nivel de clase también aplica y el del handler gana.
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const user = request.user;

    return next.handle().pipe(
      // Se recibe el resultado para poder sacar el id cuando la entidad se acaba de
      // crear y la ruta no lo lleva en los params.
      tap((result: unknown) => {
        // Sin await a propósito: la auditoría no debe añadir latencia a la respuesta.
        // El .catch() no es redundante aunque createLog ya capture lo suyo: sin él, un
        // rechazo inesperado se convertiría en unhandledRejection y tumbaría el proceso.
        this.auditService
          .createLog({
            userId: user?.sub,
            userName: user?.name ?? user?.email ?? undefined,
            action: meta.action,
            entityType: meta.entityType,
            entityId: this.resolveEntityId(request, result),
            newValue: request.body,
            ipAddress: resolveIp(request),
          })
          .catch((error: unknown) => {
            this.logger.error(
              `Fallo al auditar "${meta.action}": ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });
      }),
    );
  }

  /** El id de la ruta manda; si no hay (creaciones), se toma del cuerpo devuelto. */
  private resolveEntityId(
    request: AuditableRequest,
    result: unknown,
  ): string | undefined {
    const fromParams = request.params?.id;
    if (fromParams) return fromParams;
    if (result && typeof result === 'object' && 'id' in result) {
      const id = (result as { id: unknown }).id;
      if (typeof id === 'string') return id;
    }
    return undefined;
  }
}
