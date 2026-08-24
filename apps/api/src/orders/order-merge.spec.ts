import { canMerge, type MergeCandidate } from './order-merge';

const candidate = (over: Partial<MergeCandidate> = {}): MergeCandidate => ({
  id: 'a',
  orderNumber: 1,
  status: 'pending',
  source: 'staff',
  tableId: 'mesa-1',
  mergedIntoOrderId: null,
  paidAmount: 0,
  discountAmount: 0,
  tipAmount: 0,
  ...over,
});

const source = (over: Partial<MergeCandidate> = {}) =>
  candidate({ id: 'origen', orderNumber: 12, ...over });
const target = (over: Partial<MergeCandidate> = {}) =>
  candidate({ id: 'destino', orderNumber: 11, ...over });

describe('reglas de fusión de cuentas', () => {
  it('dos cuentas abiertas y limpias se fusionan', () => {
    expect(canMerge(source(), target())).toEqual({ ok: true });
  });

  /**
   * El caso que da nombre a la funcionalidad. No se exige la misma mesa: juntar la 4 con la 5 es
   * literalmente lo que se pide, y exigirlo dejaría fuera el único caso que importa.
   */
  it('se pueden fusionar cuentas de mesas distintas', () => {
    expect(canMerge(source({ tableId: 'mesa-4' }), target({ tableId: 'mesa-5' }))).toEqual({
      ok: true,
    });
  });

  it('una cuenta no se fusiona consigo misma', () => {
    const uno = source();
    expect(canMerge(uno, uno)).toMatchObject({ ok: false });
  });

  describe('estados', () => {
    it.each(['closed', 'cancelled'] as const)('la origen en %s no se fusiona', (status) => {
      const verdict = canMerge(source({ status }), target());
      expect(verdict).toMatchObject({ ok: false });
      if (!verdict.ok) expect(verdict.reason).toContain('#12');
    });

    it.each(['closed', 'cancelled'] as const)('la destino en %s no recibe', (status) => {
      const verdict = canMerge(source(), target({ status }));
      expect(verdict).toMatchObject({ ok: false });
      if (!verdict.ok) expect(verdict.reason).toContain('#11');
    });

    it.each(['pending', 'preparing', 'ready', 'delivered'] as const)(
      'una cuenta en %s sí se fusiona',
      (status) => {
        expect(canMerge(source({ status }), target())).toEqual({ ok: true });
      },
    );
  });

  describe('cuentas ya fusionadas', () => {
    it('la origen ya fusionada no se vuelve a fusionar', () => {
      // Encadenarlas haría que deshacer dejara de tener un resultado único.
      expect(canMerge(source({ mergedIntoOrderId: 'otra' }), target())).toMatchObject({
        ok: false,
      });
    });

    it('no se fusiona sobre una cuenta que a su vez está fusionada', () => {
      const verdict = canMerge(source(), target({ mergedIntoOrderId: 'otra' }));
      expect(verdict).toMatchObject({ ok: false });
      if (!verdict.ok) expect(verdict.reason).toContain('principal');
    });
  });

  /**
   * La precondición que hace que esta funcionalidad sea sencilla en vez de peligrosa. Con ella, los
   * dos casos difíciles —un cobro parcial que se queda sin cuenta que cobrar, y un descuento
   * aprobado sobre una cuenta que se vacía— no se resuelven: **no pueden ocurrir**.
   */
  describe('dinero en la cuenta origen', () => {
    it('con pagos registrados no se fusiona, y el mensaje dice cuál', () => {
      const verdict = canMerge(source({ paidAmount: 50 }), target());
      expect(verdict).toMatchObject({ ok: false });
      if (!verdict.ok) {
        expect(verdict.reason).toContain('#12');
        expect(verdict.reason).toMatch(/pagos/i);
      }
    });

    it('con descuento aplicado no se fusiona', () => {
      expect(canMerge(source({ discountAmount: 10 }), target())).toMatchObject({ ok: false });
    });

    it('con propina no se fusiona', () => {
      expect(canMerge(source({ tipAmount: 20 }), target())).toMatchObject({ ok: false });
    });

    it('un importe de céntimos por redondeo no bloquea la fusión', () => {
      // Misma tolerancia que usan `PaymentsService` y `DiscountsService` al comparar importes.
      expect(canMerge(source({ paidAmount: 0.0005 }), target())).toEqual({ ok: true });
    });

    /**
     * En la cuenta **destino** el dinero no estorba: nada se le quita, solo se le añaden líneas, y
     * `computeTotals` recalcula el total con el descuento que ya tenía.
     */
    it('el dinero en la cuenta destino no impide recibir', () => {
      expect(
        canMerge(source(), target({ paidAmount: 0, discountAmount: 30, tipAmount: 15 })),
      ).toEqual({ ok: true });
    });
  });

  it('una venta de mostrador no se fusiona, ni como origen ni como destino', () => {
    // La única forma de encontrarse una abierta es que su cobro fallara. Mudarle las líneas a la
    // cuenta de una mesa metería ese importe en el consumo de unos clientes que no pidieron eso.
    const mostrador = candidate({ id: 'm', orderNumber: 9, source: 'counter', tableId: null });
    const mesa = candidate({ id: 'b', orderNumber: 2 });

    expect(canMerge(mostrador, mesa)).toMatchObject({ ok: false });
    expect(canMerge(mesa, mostrador)).toMatchObject({ ok: false });
  });

});
