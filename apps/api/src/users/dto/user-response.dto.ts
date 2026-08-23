import type { User } from '../entities/user.entity';

/**
 * La forma que sale por HTTP, que **no** es la entidad.
 *
 * Se define aquí a mano en vez de importar `User` de `@loklflow/types` por el mismo motivo que
 * el resto de constantes del backend: importar el paquete compartido en compilación levanta el
 * `rootDir` que infiere tsc y la salida se mueve de `dist/main.js` a `dist/src/main.js`. El
 * contrato vive en `packages/types/src/users/user.interface.ts` y este tipo lo replica.
 *
 * Existe porque devolver la entidad tal cual mandaba `role` anidado —el objeto Role entero, con
 * su umbral de descuento y sus banderas— mientras el contrato declaraba `roleId` y `roleName`
 * planos. TypeScript no se enteraba: el front hace `serverFetch<User[]>`, que es un cast, así que
 * `u.roleName` era `undefined` en tiempo de ejecución y la columna «Rol» del listado de empleados
 * salía en blanco. Lo mismo dejaba sin preseleccionar el rol al editar un empleado.
 *
 * `password` y `pin` no están, y no es solo que la entidad los marque `select: false`: aquí se
 * enumeran los campos uno a uno, así que un `select` mal escrito en el futuro no puede colarlos.
 */
export interface UserResponse {
  id: string;
  name: string;
  email: string | null;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    // `role` es eager en la entidad, pero un usuario cargado con un `select` explícito podría
    // no traerlo; se prefiere una cadena vacía a reventar el listado entero.
    roleId: user.role?.id ?? '',
    roleName: user.role?.name ?? '',
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
