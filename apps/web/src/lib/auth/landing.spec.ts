import { describe, expect, it } from 'vitest';
import { DEFAULT_LANDING, landingFor } from './landing';

describe('landingFor', () => {
  /**
   * El caso que motivó la regla del dueño: un administrador tiene `tables:update` como cualquier
   * mesero, así que sin ella aterrizaba en el salón entrando por PIN —mientras que entrando por
   * correo iba al panel—. Dos puertas, dos destinos.
   */
  it('el dueño empieza en su panel, aunque también pueda atender mesas', () => {
    expect(
      landingFor(['business_config:update', 'tables:update', 'pos:create', 'orders:update']),
    ).toBe('/admin');
  });

  it('pero un gerente que atiende mesas sigue empezando en el salón', () => {
    // Tiene `business_config:read`, no `update`: el discriminador distingue gestionar de mandar.
    expect(landingFor(['business_config:read', 'tables:update', 'pos:create'])).toBe('/waiter');
  });

  it('el mesero empieza en el salón', () => {
    expect(landingFor(['tables:update', 'orders:create'])).toBe('/waiter');
  });

  it('el cajero, en la caja', () => {
    expect(landingFor(['pos:create', 'pos:read'])).toBe('/pos');
  });

  it('la cocina, en el KDS', () => {
    expect(landingFor(['orders:update', 'orders:read'])).toBe('/kitchen');
  });

  it('quien no atiende ni cobra ni cocina, en administración', () => {
    expect(landingFor(['reports:read'])).toBe(DEFAULT_LANDING);
  });

  /**
   * El orden de la tabla no es alfabético ni casual: un gerente que además atiende mesas tiene
   * los tres permisos, y quiere empezar donde está de pie.
   */
  it('con varios permisos gana el salón', () => {
    expect(landingFor(['pos:create', 'orders:update', 'tables:update'])).toBe('/waiter');
  });

  it('la caja gana a la cocina', () => {
    expect(landingFor(['orders:update', 'pos:create'])).toBe('/pos');
  });

  describe('sin permisos', () => {
    // `permissions` es opcional en `AuthUser`: un token viejo o una respuesta recortada llegan
    // sin él, y lo que no puede pasar es que el empleado se quede en la pantalla del PIN.
    it.each([[[]], [null], [undefined]])('%s cae en administración', (perms) => {
      expect(landingFor(perms as string[] | null | undefined)).toBe(DEFAULT_LANDING);
    });
  });
});
