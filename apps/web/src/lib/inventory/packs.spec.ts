import { describe, expect, it } from 'vitest';
import { packNote, packTotal } from './packs';

describe('packTotal', () => {
  it('multiplica cajas por unidades', () => {
    expect(packTotal('6', '24')).toBe(144);
  });

  /** El teclado numérico en español ofrece la coma antes que el punto. */
  it('acepta la coma decimal', () => {
    expect(packTotal('1,5', '24')).toBe(36);
  });

  it('redondea a tres decimales, como el stock', () => {
    expect(packTotal('0.001', '0.001')).toBe(0);
  });

  describe('lo que no da un total', () => {
    it.each([
      ['', '24'],
      ['6', ''],
      ['abc', '24'],
      ['6', 'abc'],
      ['0', '24'],
      ['6', '0'],
      ['-6', '24'],
    ])('cajas «%s» × «%s» es null', (cajas, porCaja) => {
      expect(packTotal(cajas, porCaja)).toBeNull();
    });
  });
});

describe('packNote', () => {
  it('describe el cálculo cuando el total sigue siendo el suyo', () => {
    expect(packNote('6', '24', 144)).toBe('6 cajas × 24');
  });

  it('una caja va en singular', () => {
    expect(packNote('1', '24', 24)).toBe('1 caja × 24');
  });

  /**
   * La razón de ser de la función. El campo grande se corrige a mano —seis cajas y tres
   * sueltas—, y desde ese momento «6 cajas × 24» sería mentira en el libro mayor.
   */
  it('calla en cuanto el total deja de cuadrar', () => {
    expect(packNote('6', '24', 147)).toBeUndefined();
  });

  it('y calla también si no hay cajas que describir', () => {
    expect(packNote('', '24', 144)).toBeUndefined();
  });
});
