import { computeTotals, itemSubtotal } from './order-totals';

describe('itemSubtotal', () => {
  it('multiplica precio unitario por cantidad', () => {
    expect(itemSubtotal(3, 10)).toBe(30);
  });

  it('suma los ajustes de los modificadores antes de multiplicar', () => {
    // (10 + 2.5) * 2 = 25 — el ajuste es por unidad, no por línea.
    expect(itemSubtotal(2, 10, [{ priceAdjustment: 2.5 }])).toBe(25);
  });

  it('admite ajustes negativos', () => {
    expect(itemSubtotal(1, 10, [{ priceAdjustment: -1.5 }])).toBe(8.5);
  });

  it('acumula varios modificadores', () => {
    expect(itemSubtotal(1, 10, [{ priceAdjustment: 1 }, { priceAdjustment: 2 }])).toBe(13);
  });

  it('acepta los numeric de Postgres, que TypeORM entrega como string', () => {
    expect(itemSubtotal(2, '10.50', [{ priceAdjustment: '0.25' }])).toBe(21.5);
  });

  it('redondea a 2 decimales devolviendo número', () => {
    const r = itemSubtotal(3, 0.1);
    expect(r).toBe(0.3);
    expect(typeof r).toBe('number');
  });

  it('da 0 si la cantidad es 0', () => {
    expect(itemSubtotal(0, 99)).toBe(0);
  });
});

describe('computeTotals', () => {
  const item = (subtotal: number | string, status = 'pending') => ({ subtotal, status });

  it('suma los subtotales de las líneas', () => {
    expect(computeTotals([item(10), item(5.5)])).toEqual({ subtotal: 15.5, total: 15.5 });
  });

  it('excluye las líneas canceladas', () => {
    expect(computeTotals([item(10), item(99, 'cancelled')])).toEqual({
      subtotal: 10,
      total: 10,
    });
  });

  it('incluye las líneas entregadas y en preparación', () => {
    const r = computeTotals([item(10, 'delivered'), item(5, 'preparing')]);
    expect(r.subtotal).toBe(15);
  });

  it('resta el descuento y suma la propina', () => {
    expect(computeTotals([item(100)], 10, 5)).toEqual({ subtotal: 100, total: 95 });
  });

  it('el descuento no altera el subtotal, solo el total', () => {
    const r = computeTotals([item(100)], 30);
    expect(r.subtotal).toBe(100);
    expect(r.total).toBe(70);
  });

  it('trata null y undefined como cero', () => {
    // El campo llega así cuando la orden aún no tiene propina ni descuento.
    expect(computeTotals([item(20)], null as unknown as number, undefined)).toEqual({
      subtotal: 20,
      total: 20,
    });
  });

  it('acepta descuento y propina como string', () => {
    expect(computeTotals([item('50.00')], '5.50', '2.25')).toEqual({
      subtotal: 50,
      total: 46.75,
    });
  });

  it('da 0 con la orden vacía', () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, total: 0 });
  });

  it('da 0 si todas las líneas están canceladas', () => {
    expect(computeTotals([item(10, 'cancelled')])).toEqual({ subtotal: 0, total: 0 });
  });

  it('no arrastra el error de coma flotante al acumular', () => {
    // 0.1 + 0.2 = 0.30000000000000004 sin redondeo.
    expect(computeTotals([item(0.1), item(0.2)]).subtotal).toBe(0.3);
  });

  it('permite total negativo si el descuento excede el subtotal', () => {
    // No se satura a 0: la validación de importe máximo es responsabilidad de
    // quien aplica el descuento, no del cálculo.
    expect(computeTotals([item(10)], 15).total).toBe(-5);
  });
});
