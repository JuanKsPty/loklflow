/**
 * Un empleado **tal y como sale de la API**, que no es la entidad: el rol viaja plano
 * (`roleId` + `roleName`), no como objeto anidado. Lo aplana `toUserResponse` en
 * `apps/api/src/users/dto/user-response.dto.ts`, y los dos hay que moverlos a la vez —
 * el front lee esto a través de un cast (`serverFetch<User[]>`), así que una discrepancia
 * no la ve el compilador: sale como una columna en blanco en pantalla.
 *
 * `pin` no está, y no es un olvido: es un hash bcrypt y la API no lo devuelve nunca.
 * Declararlo invitaba a pintarlo.
 */
export interface User {
  id: string;
  name: string;
  email: string | null;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email?: string;
  password?: string;
  pin?: string;
  roleId: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  pin?: string;
  roleId?: string;
  isActive?: boolean;
}
