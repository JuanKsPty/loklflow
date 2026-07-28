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
  permissions: string[];
  loginMethod: 'email' | 'pin';
  iat?: number;
  exp?: number;
}
