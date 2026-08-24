/**
 * A qué pantalla va cada empleado al entrar.
 *
 * Vivía dentro de `PinPad`, entre un `try` y un `toast`. Es lógica de negocio —decide dónde
 * empieza el turno de cada rol— y estaba donde solo se podía probar montando el componente
 * entero, con su router, su store y su llamada de red simuladas.
 *
 * El orden **importa** y no es alfabético: un mismo empleado puede tener varios de estos
 * permisos, y el primero que case gana. Un gerente que además atiende mesas tiene `tables:update`
 * *y* `pos:create`, y quiere empezar en el salón, que es donde está de pie.
 */
const ROUTES: { permission: string; path: string }[] = [
  /**
   * El dueño, primero. `business_config:update` lo tiene **solo** el Administrador —el Gerente
   * tiene `business_config:read` pero no `update`—, así que es el discriminador limpio para «esta
   * persona gestiona el negocio» sin tocar a quien está de pie.
   *
   * Sin esta línea, un administrador que entra por PIN aterrizaba en `/waiter`: tiene
   * `tables:update` como cualquier mesero, y la primera regla que casa gana. Entrando por correo
   * iba a `/admin`, así que las dos puertas de la aplicación llevaban a sitios distintos.
   */
  { permission: 'business_config:update', path: '/admin' },
  { permission: 'tables:update', path: '/waiter' },
  { permission: 'pos:create', path: '/pos' },
  { permission: 'orders:update', path: '/kitchen' },
];

/** Donde acaba quien no encaja en ninguna pantalla operativa. */
export const DEFAULT_LANDING = '/admin';

export function landingFor(permissions: readonly string[] | null | undefined): string {
  const perms = permissions ?? [];
  return ROUTES.find((r) => perms.includes(r.permission))?.path ?? DEFAULT_LANDING;
}
