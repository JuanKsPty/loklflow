import type { AuditAction } from '@loklflow/types';

/**
 * Color por severidad, no por módulo: lo que importa al revisar una bitácora es
 * distinguir de un vistazo lo destructivo y lo sensible del ruido de fondo.
 * Fórmula del repo: border-X/30 bg-X/10 text-X.
 */
export const AUDIT_ACTION_BADGE: Record<AuditAction, string> = {
  // Destructivo o irreversible
  'user.deactivated': 'border-destructive/30 bg-destructive/10 text-destructive',
  'role.deleted': 'border-destructive/30 bg-destructive/10 text-destructive',
  'order.cancelled': 'border-destructive/30 bg-destructive/10 text-destructive',
  'auth.login_failed': 'border-destructive/30 bg-destructive/10 text-destructive',

  // Cambios de privilegios: el mayor impacto en seguridad
  'user.role_changed': 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  'role.permissions_changed': 'border-amber-500/30 bg-amber-500/10 text-amber-600',

  // Dinero
  'payment.recorded': 'border-success/30 bg-success/10 text-success',
  'shift.opened': 'border-teal-500/30 bg-teal-500/10 text-teal-600',
  'shift.closed': 'border-teal-500/30 bg-teal-500/10 text-teal-600',

  // Alta y edición de datos maestros
  'user.created': 'border-primary/30 bg-primary/10 text-primary',
  'user.updated': 'border-primary/30 bg-primary/10 text-primary',
  'role.created': 'border-primary/30 bg-primary/10 text-primary',
  'role.updated': 'border-primary/30 bg-primary/10 text-primary',

  // Rutina
  'auth.login': 'border-border bg-muted text-muted-foreground',
  'auth.logout': 'border-border bg-muted text-muted-foreground',
};

/** Grupos para los filtros por pills de la vista. */
export const AUDIT_FILTER_GROUPS = [
  { value: 'all', label: 'Todo' },
  { value: 'auth.login_failed', label: 'Intentos fallidos' },
  { value: 'user.role_changed', label: 'Cambios de rol' },
  { value: 'role.permissions_changed', label: 'Permisos' },
  { value: 'order.cancelled', label: 'Cancelaciones' },
  { value: 'shift.closed', label: 'Cierres de caja' },
  { value: 'payment.recorded', label: 'Pagos' },
] as const;
