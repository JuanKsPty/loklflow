import { describe, expect, it } from 'vitest';
import { buildCrumbs } from './app-header';
import { NAV_ITEMS } from './nav-items';

/**
 * Las migas de pan del panel.
 *
 * Lo que de verdad se protege es que `SEGMENT_LABELS` no se quede corto: media navegación decía
 * «Detalle» porque faltaban `products`, `inventario`, `proveedores`… Este test recorre las rutas
 * reales, así que una sección nueva lo rompe hasta que se le dé nombre.
 */
describe('buildCrumbs', () => {
  it('nombra cada nivel de una ruta de alta', () => {
    expect(buildCrumbs('/admin/menu/products/new').map((c) => c.label)).toEqual([
      'Administración',
      'Menú',
      'Productos',
      'Nuevo',
    ]);
  });

  it('un identificador en una ficha se lee como «Detalle», no como el uuid', () => {
    const crumbs = buildCrumbs('/admin/inventario/ingredientes/8f14e45f-ceea-467a-9f6a-6b4b1e3a1f0e');
    expect(crumbs.map((c) => c.label)).toEqual([
      'Administración',
      'Inventario',
      'Ingredientes',
      'Detalle',
    ]);
  });

  it('el último nivel es el que está abierto', () => {
    const crumbs = buildCrumbs('/admin/users');
    expect(crumbs.at(-1)).toMatchObject({ label: 'Empleados', href: '/admin/users', isLast: true });
    expect(crumbs[0].isLast).toBe(false);
  });

  it('ningún destino del menú se queda sin nombre', () => {
    // Si esto falla, hay una sección nueva en `nav-items.ts` sin entrada en `SEGMENT_LABELS`, y
    // su miga saldría en crudo —«inventario»— o como «Detalle».
    for (const item of NAV_ITEMS) {
      for (const crumb of buildCrumbs(item.href)) {
        expect(crumb.label).not.toBe('Detalle');
        expect(crumb.label).toMatch(/^[A-ZÁÉÍÓÚÑ]/);
      }
    }
  });
});
