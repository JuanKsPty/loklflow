import { describe, expect, it } from 'vitest';
import { barItemsFor, isNavItemActive, navItemsFor, NAV_ITEMS } from './nav-items';

/**
 * La navegación del panel, que es RBAC disfrazado de maqueta: un destino que se cuele sin permiso
 * es un enlace que lleva a un 403.
 */
describe('navegación del panel', () => {
  it('solo salen los destinos cuyo permiso tiene el usuario', () => {
    const items = navItemsFor(['inventory:read']);
    expect(items.map((i) => i.title)).toEqual(['Inventario']);
  });

  it('sin permisos no sale ninguno', () => {
    expect(navItemsFor([])).toEqual([]);
  });

  it('la barra inferior lleva como mucho cuatro, en su orden', () => {
    const todos = NAV_ITEMS.map((i) => i.permission);
    const barra = barItemsFor(todos);
    expect(barra).toHaveLength(4);
    expect(barra.map((i) => i.bar)).toEqual([1, 2, 3, 4]);
  });

  it('y respeta los permisos igual que el cajón', () => {
    // El quinto hueco es «Más», así que aquí solo aparece lo que puede abrir.
    expect(barItemsFor(['inventory:read']).map((i) => i.title)).toEqual(['Inventario']);
  });

  it('«Panel» solo está activo en coincidencia exacta', () => {
    // `/admin` es prefijo de todas las demás: sin esto, el panel se vería activo en todo el área.
    expect(isNavItemActive('/admin', '/admin')).toBe(true);
    expect(isNavItemActive('/admin', '/admin/menu')).toBe(false);
  });

  it('los demás se activan también en sus subrutas', () => {
    expect(isNavItemActive('/admin/menu', '/admin/menu')).toBe(true);
    expect(isNavItemActive('/admin/menu', '/admin/menu/products/new')).toBe(true);
    expect(isNavItemActive('/admin/menu', '/admin/menuother')).toBe(false);
  });
});
