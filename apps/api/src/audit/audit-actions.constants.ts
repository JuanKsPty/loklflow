// Catálogo de acciones auditables. Definido localmente para mantener el backend
// autocontenido, igual que ORDER_STATUSES en orders/order-status.constants.ts.
export const AUDIT_ACTIONS = [
  // Autenticación
  'auth.login',
  'auth.login_failed',
  'auth.login_locked',
  'auth.logout',
  // Empleados
  'user.created',
  'user.updated',
  'user.deactivated',
  'user.role_changed',
  // Roles y permisos
  'role.created',
  'role.updated',
  'role.deleted',
  'role.permissions_changed',
  // Caja
  'shift.opened',
  'shift.closed',
  'payment.recorded',
  // Descuentos
  'discount.requested',
  'discount.approved',
  'discount.rejected',
  // Órdenes
  'order.cancelled',
  'order.merged',
  'order.unmerged',
  // Mesas
  'table.qr_rotated',
  // Menú. Una importación cambia el catálogo entero de golpe: es exactamente lo que la bitácora
  // existe para poder reconstruir después.
  'menu.imported',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Tipos de entidad que acompañan a una acción, para poder filtrar la bitácora. */
export const AUDIT_ENTITY_TYPES = [
  'user',
  'role',
  'shift',
  'order',
  'payment',
  'discount',
  'table',
  'session',
  'product',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
