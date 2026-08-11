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
