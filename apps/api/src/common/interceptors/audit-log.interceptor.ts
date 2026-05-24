import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';

export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditLog = (action: string) =>
  SetMetadata(AUDIT_ACTION_KEY, action);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(() => {
        // AuditService will be injected in modules that need audit logging
        // This interceptor provides the @AuditLog decorator mechanism
        void { action, userId: user?.sub, path: request.url };
      }),
    );
  }
}
