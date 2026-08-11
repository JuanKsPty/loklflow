import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button';

/**
 * El tamaño táctil, que el sistema de diseño prometía y las tres fases táctiles no usaron.
 *
 * Se afirma sobre las clases y no sobre la geometría renderizada: jsdom no aplica Tailwind, así
 * que `getBoundingClientRect()` devolvería ceros y el test pasaría siempre. Lo que se protege es
 * el contrato — `touch` significa 44 px— para que nadie lo cambie a `h-10` (40 px) sin enterarse.
 */
describe('buttonVariants', () => {
  const classes = (opts: Parameters<typeof buttonVariants>[0]) =>
    buttonVariants(opts).split(/\s+/);

  it('touch mide 44 px, el mínimo del sistema de diseño', () => {
    // `h-11` en la escala de Tailwind son 2.75rem = 44px.
    expect(classes({ size: 'touch' })).toContain('h-11');
  });

  it('icon-touch es cuadrado y del mismo tamaño', () => {
    expect(classes({ size: 'icon-touch' })).toContain('size-11');
  });

  it('los tamaños compactos siguen siendo compactos', () => {
    // `touch` se añade, no reemplaza: las pantallas de administración se usan con ratón y
    // agrandarlo todo destrozaría maquetas densas que hoy funcionan.
    expect(classes({ size: 'default' })).toContain('h-8');
    expect(classes({ size: 'sm' })).toContain('h-7');
  });

  it('sin tamaño, el de por defecto', () => {
    expect(buttonVariants({})).toBe(buttonVariants({ size: 'default', variant: 'default' }));
  });

  it('la clase propia se añade al final, para poder pisar la variante', () => {
    const result = buttonVariants({ size: 'touch', className: 'w-full' });
    expect(result.endsWith('w-full')).toBe(true);
  });

  it('cada variante trae su color de fondo o de texto', () => {
    for (const variant of ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const) {
      expect(buttonVariants({ variant })).toMatch(/bg-|text-/);
    }
  });
});
