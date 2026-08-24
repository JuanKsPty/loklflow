import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button';

/**
 * El contrato de tamaños: compacto en escritorio, táctil en el teléfono.
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

  it('los tamaños compactos siguen siendo compactos en escritorio', () => {
    // `touch` se añadió, no reemplazó: a partir de `sm` las maquetas densas del panel se usan
    // con ratón y siguen exactamente igual que antes de que existiera el móvil.
    expect(classes({ size: 'default' })).toContain('h-8');
    expect(classes({ size: 'sm' })).toContain('h-7');
  });

  it('y suben al suelo táctil solo en el teléfono', () => {
    // El usuario principal de `/admin` abre el panel desde el móvil. 44 px y 40 px, no 36:
    // un control que mide justo el suelo del e2e falla por redondeo subpíxel.
    expect(classes({ size: 'default' })).toContain('max-sm:h-11');
    expect(classes({ size: 'sm' })).toContain('max-sm:h-10');
    expect(classes({ size: 'icon' })).toContain('max-sm:size-11');
    expect(classes({ size: 'icon-sm' })).toContain('max-sm:size-10');
  });

  /**
   * La invariante que hace revisable toda la parte móvil, y la razón de que la variante se
   * escriba `max-sm:` y no `sm:`.
   *
   * `cn()` pasa por `tailwind-merge`, que **no** ve conflicto entre `h-12` y `sm:h-8`
   * (modificadores distintos) pero sí entre `h-12` y `h-8`. Con la forma `h-11 sm:h-8`, un
   * `className="h-12"` del sitio de llamada dejaría `h-12 sm:h-8` y el botón encogería a 32 px
   * **en escritorio**. Con el valor de escritorio sin prefijo, lo pisa igual que siempre.
   */
  it('la altura de escritorio nunca va detrás de un prefijo', () => {
    for (const size of ['default', 'xs', 'sm', 'lg', 'touch'] as const) {
      expect(classes({ size }).some((c) => /^h-\d/.test(c))).toBe(true);
    }
    for (const size of ['icon', 'icon-xs', 'icon-sm', 'icon-lg', 'icon-touch'] as const) {
      expect(classes({ size }).some((c) => /^size-\d/.test(c))).toBe(true);
    }
  });

  it('touch mide 44 px a cualquier ancho, sin variante de móvil', () => {
    // Es el objetivo absoluto de las superficies de servicio, que se usan de pie: no sube ni
    // baja con el viewport.
    expect(classes({ size: 'touch' }).some((c) => c.startsWith('max-sm:h-'))).toBe(false);
    expect(classes({ size: 'icon-touch' }).some((c) => c.startsWith('max-sm:size-'))).toBe(false);
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
