import { fold, productKey } from './name-key';

/**
 * Los mismos vectores que `apps/web/src/lib/csv/coerce.spec.ts`.
 *
 * La normalización está duplicada entre las dos apps —el backend no importa `@loklflow/types` en
 * compilación—, y esta suite existe para que la duplicación no derive: si un lado cambia sin el
 * otro, la importación clasificaría como «nuevo» lo que el servidor ve como «existente».
 */
describe('normalización de nombres', () => {
  it('fold pliega acentos, mayúsculas y espacios', () => {
    expect(fold('  Postres  ')).toBe('postres');
    expect(fold('BEBIDAS FRÍAS')).toBe('bebidas frias');
    expect(fold('Café  con   leche')).toBe('cafe con leche');
  });

  it('la clave de producto conserva la eñe', () => {
    expect(productKey('PIÑA')).not.toBe(productKey('Pina'));
    expect(productKey('PIÑA')).toBe(productKey('piña'));
  });

  it('pero normaliza mayúsculas y espacios de más', () => {
    expect(productKey('  Taco   al pastor ')).toBe('taco al pastor');
    expect(productKey('TACO AL PASTOR')).toBe('taco al pastor');
  });
});
