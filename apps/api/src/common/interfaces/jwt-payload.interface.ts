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
  /**
   * Versión de sesión del usuario (`users.token_version`).
   *
   * **Opcional a propósito**: los tokens emitidos antes de que esto existiera no lo llevan y se
   * tratan como versión 0, que es la de todos los usuarios tras la migración. Así el despliegue no
   * expulsa a nadie —importante en una caja registradora— y la comprobación se vuelve efectiva
   * sola conforme las sesiones se renuevan.
   */
  tv?: number;
  iat?: number;
  exp?: number;
}
