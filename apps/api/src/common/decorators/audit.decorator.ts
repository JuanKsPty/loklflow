import { SetMetadata } from '@nestjs/common';
import type {
  AuditAction,
  AuditEntityType,
} from '../../audit/audit-actions.constants';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: AuditAction;
  entityType?: AuditEntityType;
}

/**
 * Marca un handler para que el AuditLogInterceptor registre la acción.
 * Se llama `Audit` y no `AuditLog` para no chocar con la entidad AuditLog.
 *
 * Solo para acciones donde basta con "quién, qué y cuándo". Cuando hace falta el
 * valor anterior (oldValue) hay que auditar dentro del service, porque el
 * interceptor corre cuando la mutación ya ocurrió.
 */
export const Audit = (action: AuditAction, entityType?: AuditEntityType) =>
  SetMetadata(AUDIT_KEY, { action, entityType } satisfies AuditMeta);
