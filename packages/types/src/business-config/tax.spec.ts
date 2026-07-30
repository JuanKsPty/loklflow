import { taxBreakdown } from './business-config.interface';

describe('taxBreakdown', () => {
  it('desglosa el IVA contenido en un precio que ya lo incluye', () => {
    // 116 con IVA del 16% → base 100, impuesto 16.
    expect(taxBreakdown(116, 16)).toEqual({ base: 100, tax: 16 });
  });

  it('la base más el impuesto reconstruyen el total', () => {
    const { base, tax } = taxBreakdown(250.75, 19);
    expect(Number((base + tax).toFixed(2))).toBe(250.75);
  });

  it('con tasa 0 no hay impuesto y la base es el total', () => {
    expect(taxBreakdown(99.9, 0)).toEqual({ base: 99.9, tax: 0 });
  });

  it('trata una tasa negativa como 0 en lugar de inventar un impuesto', () => {
    expect(taxBreakdown(100, -5)).toEqual({ base: 100, tax: 0 });
  });

  it('un total de 0 no produce NaN', () => {
    expect(taxBreakdown(0, 16)).toEqual({ base: 0, tax: 0 });
  });

  it('acepta los decimal que llegan como string', () => {
    expect(taxBreakdown('116.00', '16.00')).toEqual({ base: 100, tax: 16 });
  });

  it('redondea a 2 decimales', () => {
    const { base, tax } = taxBreakdown(33.33, 16);
    expect(base).toBe(28.73);
    expect(tax).toBe(4.6);
  });

  it('trata null y undefined como 0', () => {
    expect(taxBreakdown(100, null as unknown as number)).toEqual({ base: 100, tax: 0 });
    expect(taxBreakdown(100, undefined)).toEqual({ base: 100, tax: 0 });
  });
});
