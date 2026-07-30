export interface JwtPayload {
  sub: string;
  /**
   * Nombre del empleado. Opcional porque los tokens emitidos antes de añadirlo no lo
   * llevan; en ese caso hay que caer a `email`.
   */
  name?: string;
  email: string | null;
  roleId: string;
  roleName: string;
  /**
   * Umbral de descuento del rol, en porcentaje. Solo una pista para la UI: el backend
   * revalida siempre contra la base de datos.
   */
  maxDiscountPercentage?: number;
  permissions: string[];
  loginMethod: 'email' | 'pin';
  iat?: number;
  exp?: number;
}
