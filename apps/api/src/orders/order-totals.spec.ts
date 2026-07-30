import {
  computeTotals,
  discountAsPercentage,
  itemSubtotal,
  percentageAsAmount,
} from './order-totals';

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

  it('no deja el total negativo si el descuento excede el subtotal', () => {
    // Red de seguridad: un cobro negativo descuadraría la caja. La validación con
    // mensaje al usuario vive en quien aplica el descuento.
    expect(computeTotals([item(10)], 15).total).toBe(0);
  });

  it('el clamp no se come una propina que compensa el descuento', () => {
    // subtotal 10 − descuento 15 + propina 20 = 15, sigue siendo positivo.
    expect(computeTotals([item(10)], 15, 20).total).toBe(15);
  });
});

describe('discountAsPercentage', () => {
  it('convierte un importe a su porcentaje del subtotal', () => {
    expect(discountAsPercentage(200, 50)).toBe(25);
  });

  it('da 100 cuando el descuento es todo el subtotal', () => {
    expect(discountAsPercentage(80, 80)).toBe(100);
  });

  it('pasa de 100 cuando el descuento excede el subtotal, para que no cuele por un umbral', () => {
    expect(discountAsPercentage(50, 75)).toBe(150);
  });

  it('da 0 sin descuento', () => {
    expect(discountAsPercentage(100, 0)).toBe(0);
  });

  it('trata un subtotal de 0 como 100%, nunca como 0', () => {
    // Con base 0 la división sería infinita; devolver 0 dejaría pasar cualquier
    // descuento por debajo de cualquier umbral.
    expect(discountAsPercentage(0, 10)).toBe(100);
  });

  it('acepta los numeric que TypeORM entrega como string', () => {
    expect(discountAsPercentage('200.00', '20.00')).toBe(10);
  });

  it('redondea a 2 decimales', () => {
    // 10/3 = 3.333…%
    expect(discountAsPercentage(300, 10)).toBe(3.33);
  });
});

describe('percentageAsAmount', () => {
  it('calcula el importe de un porcentaje', () => {
    expect(percentageAsAmount(200, 15)).toBe(30);
  });

  it('redondea a 2 decimales', () => {
    // 33% de 10.10 = 3.333
    expect(percentageAsAmount(10.1, 33)).toBe(3.33);
  });

  it('da 0 con porcentaje 0 o subtotal 0', () => {
    expect(percentageAsAmount(100, 0)).toBe(0);
    expect(percentageAsAmount(0, 50)).toBe(0);
  });

  it('es el inverso de discountAsPercentage', () => {
    const amount = percentageAsAmount(240, 25);
    expect(amount).toBe(60);
    expect(discountAsPercentage(240, amount)).toBe(25);
  });
});
