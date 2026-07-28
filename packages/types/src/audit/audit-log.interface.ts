export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'user.role_changed'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'role.permissions_changed'
  | 'shift.opened'
  | 'shift.closed'
  | 'payment.recorded'
  | 'order.cancelled';

export const AUDIT_ACTIONS: AuditAction[] = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'user.created',
  'user.updated',
  'user.deactivated',
  'user.role_changed',
  'role.created',
  'role.updated',
  'role.deleted',
  'role.permissions_changed',
  'shift.opened',
  'shift.closed',
  'payment.recorded',
  'order.cancelled',
];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'auth.login': 'Inicio de sesión',
  'auth.login_failed': 'Intento fallido',
  'auth.logout': 'Cierre de sesión',
  'user.created': 'Empleado creado',
  'user.updated': 'Empleado editado',
  'user.deactivated': 'Empleado dado de baja',
  'user.role_changed': 'Rol de empleado cambiado',
  'role.created': 'Rol creado',
  'role.updated': 'Rol editado',
  'role.deleted': 'Rol eliminado',
  'role.permissions_changed': 'Permisos modificados',
  'shift.opened': 'Turno abierto',
  'shift.closed': 'Turno cerrado',
  'payment.recorded': 'Pago registrado',
  'order.cancelled': 'Orden cancelada',
};

export type AuditEntityType =
  | 'user'
  | 'role'
  | 'shift'
  | 'order'
  | 'payment'
  | 'session';

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  user: 'Empleado',
  role: 'Rol',
  shift: 'Turno',
  order: 'Orden',
  payment: 'Pago',
  session: 'Sesión',
};

export interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  action: AuditAction;
  entityType: AuditEntityType | null;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * El endpoint de auditoría devuelve un envelope paginado, a diferencia del resto de la
 * API, que devuelve arrays planos.
 */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
