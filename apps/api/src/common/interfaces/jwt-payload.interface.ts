export interface JwtPayload {
  sub: string;
  /**
   * Nombre del empleado, para poder atribuir las acciones en la bitácora sin una
   * consulta extra por registro. Opcional porque los tokens emitidos antes de
   * añadirlo no lo llevan; en ese caso se cae a `email`.
   */
  name?: string;
  email: string | null;
  roleId: string;
  roleName: string;
  /**
   * Umbral de descuento del rol, en porcentaje. Va en el token para que el POS pueda
   * avisar de si un descuento necesitará aprobación sin consultar `/roles/:id`, que el
   * rol Cajero no tiene permiso de leer.
   *
   * Es solo una pista para la UI: el backend siempre revalida contra la base de datos,
   * así que un token con el umbral desactualizado no puede autorizar nada de más.
   */
  maxDiscountPercentage?: number;
  permissions: string[];
  loginMethod: 'email' | 'pin';
  iat?: number;
  exp?: number;
}
