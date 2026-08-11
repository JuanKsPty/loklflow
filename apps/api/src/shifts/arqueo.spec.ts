import { arqueo } from './arqueo';

const pago = (method: 'cash' | 'card' | 'transfer' | 'digital_wallet', amount: number | string) => ({
  method,
  amount,
});

describe('arqueo de caja', () => {
  it('un turno recién abierto espera exactamente el fondo de caja', () => {
    const r = arqueo({ openingCash: 100, closingCash: null, payments: [] });

    expect(r).toMatchObject({
      totalSales: 0,
      cashSales: 0,
      expectedCash: 100,
      countedCash: null,
      difference: null,
      paymentsCount: 0,
    });
  });

  it('desglosa por método y suma el total', () => {
    const r = arqueo({
      openingCash: 50,
      closingCash: null,
      payments: [pago('cash', 100), pago('card', 250), pago('cash', 30), pago('transfer', 20)],
    });

    expect(r.byMethod).toEqual({ cash: 130, card: 250, transfer: 20, digital_wallet: 0 });
    expect(r.totalSales).toBe(400);
    expect(r.cashSales).toBe(130);
  });

  /** Solo el efectivo está en el cajón: una tarjeta no se cuenta al cerrar. */
  it('lo esperado en caja es apertura más ventas en efectivo, y nada más', () => {
    const r = arqueo({
      openingCash: 50,
      closingCash: null,
      payments: [pago('cash', 100), pago('card', 900)],
    });

    expect(r.expectedCash).toBe(150);
  });

  it('la diferencia es lo contado menos lo esperado', () => {
    const sobra = arqueo({ openingCash: 50, closingCash: 155, payments: [pago('cash', 100)] });
    const falta = arqueo({ openingCash: 50, closingCash: 140, payments: [pago('cash', 100)] });
    const cuadra = arqueo({ openingCash: 50, closingCash: 150, payments: [pago('cash', 100)] });

    expect(sobra.difference).toBe(5);
    expect(falta.difference).toBe(-10);
    expect(cuadra.difference).toBe(0);
  });

  it('mientras el turno sigue abierto no hay diferencia que enseñar', () => {
    // `0` diría «la caja cuadra», que es exactamente lo contrario de «todavía no se ha contado».
    const r = arqueo({ openingCash: 50, closingCash: null, payments: [pago('cash', 100)] });

    expect(r.countedCash).toBeNull();
    expect(r.difference).toBeNull();
  });

  describe('coma flotante', () => {
    it('tres pagos de 0.1 son 0.3, no 0.30000000000000004', () => {
      const r = arqueo({
        openingCash: 0,
        closingCash: 0.3,
        payments: [pago('cash', 0.1), pago('cash', 0.1), pago('cash', 0.1)],
      });

      expect(r.cashSales).toBe(0.3);
      expect(r.expectedCash).toBe(0.3);
      expect(r.difference).toBe(0);
    });

    it('cien pagos con céntimos no acumulan error', () => {
      const payments = Array.from({ length: 100 }, () => pago('cash', 19.99));
      const r = arqueo({ openingCash: 0, closingCash: 1999, payments });

      expect(r.cashSales).toBe(1999);
      expect(r.difference).toBe(0);
    });

    it('el total suma los métodos ya redondeados', () => {
      const r = arqueo({
        openingCash: 0,
        closingCash: null,
        payments: [pago('cash', 0.1), pago('card', 0.2)],
      });

      expect(r.totalSales).toBe(0.3);
    });
  });

  /**
   * `numeric` de Postgres llega al driver como **cadena**. Si el cálculo no la convierte,
   * `openingCash + cashSales` concatena: `'100' + 50` es `'10050'`, y el arqueo diría que
   * faltan diez mil pesos.
   */
  it('acepta los importes tal y como los devuelve Postgres, en cadena', () => {
    const r = arqueo({
      openingCash: '100.00',
      closingCash: '250.00',
      payments: [pago('cash', '150.00')],
    });

    expect(r.expectedCash).toBe(250);
    expect(r.difference).toBe(0);
  });

  it('todos los métodos aparecen aunque nadie haya pagado con ellos', () => {
    // La pantalla del arqueo pinta las cuatro filas; una clave ausente saldría como «—».
    const r = arqueo({ openingCash: 0, closingCash: null, payments: [] });

    expect(Object.keys(r.byMethod).sort()).toEqual(['card', 'cash', 'digital_wallet', 'transfer']);
  });
});
