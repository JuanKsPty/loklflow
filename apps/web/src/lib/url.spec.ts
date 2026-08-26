import { describe, expect, it } from 'vitest';
import { buildHref, hasAnyFilter, hrefWith } from './url';

describe('buildHref', () => {
  it('sin parámetros devuelve la ruta pelada, sin el interrogante', () => {
    expect(buildHref('/admin/menu')).toBe('/admin/menu');
    expect(buildHref('/admin/menu', { q: undefined })).toBe('/admin/menu');
  });

  it('omite lo vacío, lo nulo y lo falso', () => {
    expect(buildHref('/x', { a: '', b: null, c: undefined, d: false, e: '1' })).toBe('/x?e=1');
  });

  // `?lowStock=false` no significa nada para el servidor y ensucia lo que se comparte.
  it('escribe los números y los booleanos verdaderos', () => {
    expect(buildHref('/x', { take: 200, lowStock: true })).toBe('/x?take=200&lowStock=true');
  });

  /**
   * El motivo de usar URLSearchParams y no una plantilla. El catálogo es en español: una
   * categoría se llama «Panadería» y otra puede llamarse «Bebidas & Café», que concatenada a
   * mano parte la URL en dos parámetros y pierde media palabra.
   */
  it('codifica acentos y ampersands', () => {
    expect(buildHref('/x', { categoria: 'Panadería' })).toBe('/x?categoria=Panader%C3%ADa');
    expect(buildHref('/x', { categoria: 'Bebidas & Café' })).toBe(
      '/x?categoria=Bebidas+%26+Caf%C3%A9',
    );
  });

  it('codifica el porcentaje, que en una búsqueda es un carácter más', () => {
    expect(buildHref('/x', { q: '100%' })).toBe('/x?q=100%25');
  });
});

describe('hrefWith', () => {
  it('conserva los demás parámetros', () => {
    expect(
      hrefWith('/admin/inventario', { tab: 'products', q: 'leche' }, { categoria: 'Lácteos' }),
    ).toBe('/admin/inventario?tab=products&q=leche&categoria=L%C3%A1cteos');
  });

  // Es lo que hace el «Todos» de un chip y el «Quitar filtros» de un estado vacío.
  it('undefined quita el parámetro', () => {
    expect(hrefWith('/x', { tab: 'products', q: 'leche' }, { q: undefined })).toBe(
      '/x?tab=products',
    );
  });

  it('no muta el objeto que recibe', () => {
    const params = { tab: 'products', q: 'leche' };
    hrefWith('/x', params, { q: undefined });
    expect(params).toEqual({ tab: 'products', q: 'leche' });
  });
});

describe('hasAnyFilter', () => {
  it('distingue «sin filtros» de «con filtros»', () => {
    expect(hasAnyFilter({ q: undefined, categoria: '' })).toBe(false);
    expect(hasAnyFilter({ q: 'leche' })).toBe(true);
    expect(hasAnyFilter({ lowStock: true })).toBe(true);
  });
});
