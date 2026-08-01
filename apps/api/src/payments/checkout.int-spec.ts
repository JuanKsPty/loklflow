import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, firstTable, sessionAs, tableStatus } from '../../test/fixtures';

/**
 * El camino del dinero completo: cuenta, descuento con aprobación, cobro en varios pagos,
 * cierre y arqueo. Es donde estaban los bugs de las fases anteriores, y hasta ahora solo
 * había tests unitarios de las funciones de cálculo, con los repositorios simulados.
 */
describe('Cobro de una cuenta', () => {
  let app: INestApplication;
  let waiter: string;
  let cashier: string;
  let manager: string;
  let product: { id: string; price: number };
  let table: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    // Sesiones con el usuario y el rol reales: el umbral de descuento se lee del rol en la
    // base de datos, y los turnos de caja se abren por usuario.
    waiter = await sessionAs(app, 'mesero@loklflow.com', ['orders:create', 'orders:read']);
    cashier = await sessionAs(app, 'cajero@loklflow.com', [
      'pos:create',
      'pos:read',
      'orders:read',
    ]);
    manager = await sessionAs(app, 'admin@loklflow.com', [
      'pos:approve_discount',
      'pos:read',
      'orders:read',
    ]);
    product = await firstProduct(app);
    table = await firstTable(app);
  });

  beforeEach(async () => {
    await resetOperationalData(app.get(DataSource));
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  /** Cuenta de 10 unidades en una mesa, con el turno de caja ya abierto. */
  async function openTab() {
    await http()
      .post('/api/shifts/open')
      .set('Cookie', cashier)
      .send({ openingCash: 100 })
      .expect(201);

    const res = await http()
      .post('/api/orders')
      .set('Cookie', waiter)
      .send({ tableId: table.id, items: [{ productId: product.id, quantity: 10 }] })
      .expect(201);

    return { id: res.body.id as string, total: Number(res.body.total) };
  }

  it('exige un turno de caja abierto para cobrar', async () => {
    const order = await http()
      .post('/api/orders')
      .set('Cookie', waiter)
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);

    // Sin turno abierto: el pago no puede quedar sin asignar a un arqueo.
    const res = await http()
      .post(`/api/orders/${order.body.id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'cash', amount: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('turno');
  });

  it('cobra en dos pagos, cierra la cuenta y libera la mesa', async () => {
    const { id, total } = await openTab();
    const half = Number((total / 2).toFixed(2));

    const first = await http()
      .post(`/api/orders/${id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'cash', amount: half })
      .expect(201);

    expect(first.body.paid).toBeCloseTo(half, 2);
    expect(first.body.remaining).toBeCloseTo(total - half, 2);
    expect(await tableStatus(app, table.id)).toBe('occupied');

    const second = await http()
      .post(`/api/orders/${id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'card', amount: Number((total - half).toFixed(2)) })
      .expect(201);

    expect(second.body.remaining).toBe(0);

    const order = await http().get(`/api/orders/${id}`).set('Cookie', cashier).expect(200);
    expect(order.body.status).toBe('closed');
    expect(await tableStatus(app, table.id)).toBe('available');
  });

  it('rechaza un pago que excede lo que queda', async () => {
    const { id, total } = await openTab();

    const res = await http()
      .post(`/api/orders/${id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'cash', amount: total + 10 });

    expect(res.status).toBe(400);
  });

  it('no acepta más pagos sobre una cuenta ya cerrada', async () => {
    const { id, total } = await openTab();
    await http()
      .post(`/api/orders/${id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'cash', amount: total })
      .expect(201);

    const res = await http()
      .post(`/api/orders/${id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'cash', amount: 1 });

    expect(res.status).toBe(400);
  });

  describe('descuentos', () => {
    it('aplica al instante el que cabe en el umbral del rol', async () => {
      const { id, total } = await openTab();

      // El Cajero tiene un umbral del 10%.
      const res = await http()
        .post(`/api/orders/${id}/discount`)
        .set('Cookie', cashier)
        .send({ type: 'percentage', value: 5, reason: 'Cliente habitual' })
        .expect(201);

      expect(res.body.status).toBe('approved');

      const order = await http().get(`/api/orders/${id}`).set('Cookie', cashier).expect(200);
      expect(Number(order.body.total)).toBeCloseTo(total * 0.95, 2);
    });

    it('deja pendiente el que excede el umbral, y NO toca el total', async () => {
      const { id, total } = await openTab();

      const res = await http()
        .post(`/api/orders/${id}/discount`)
        .set('Cookie', cashier)
        .send({ type: 'percentage', value: 30, reason: 'Queja por la demora' })
        .expect(201);

      expect(res.body.status).toBe('pending');

      // Lo importante: mientras no se apruebe, la cuenta sigue valiendo lo mismo.
      const order = await http().get(`/api/orders/${id}`).set('Cookie', cashier).expect(200);
      expect(Number(order.body.total)).toBeCloseTo(total, 2);
      expect(Number(order.body.discountAmount)).toBe(0);
    });

    it('al aprobarlo baja el total; al rechazarlo no', async () => {
      const { id, total } = await openTab();

      const pending = await http()
        .post(`/api/orders/${id}/discount`)
        .set('Cookie', cashier)
        .send({ type: 'percentage', value: 30, reason: 'Queja por la demora' })
        .expect(201);

      const approved = await http()
        .post(`/api/discounts/${pending.body.id}/approve`)
        .set('Cookie', manager)
        .expect(201);
      expect(approved.body.status).toBe('approved');

      const order = await http().get(`/api/orders/${id}`).set('Cookie', cashier).expect(200);
      expect(Number(order.body.total)).toBeCloseTo(total * 0.7, 2);

      // Y uno rechazado no mueve nada.
      const second = await http()
        .post(`/api/orders/${id}/discount`)
        .set('Cookie', cashier)
        .send({ type: 'percentage', value: 40, reason: 'Segundo intento' })
        .expect(201);

      await http()
        .post(`/api/discounts/${second.body.id}/reject`)
        .set('Cookie', manager)
        .send({ reason: 'No procede' })
        .expect(201);

      const after = await http().get(`/api/orders/${id}`).set('Cookie', cashier).expect(200);
      expect(Number(after.body.total)).toBeCloseTo(total * 0.7, 2);
    });

    it('no deja que un descuento baje el total por debajo de lo ya cobrado', async () => {
      // El callejón sin salida que se cerró en la fase anterior: la cuenta se quedaba
      // abierta para siempre y la mesa ocupada, porque el cierre solo ocurre al pagar y ya
      // no iba a haber más pagos.
      const { id, total } = await openTab();
      const paid = Number((total * 0.8).toFixed(2));

      await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send({ method: 'cash', amount: paid })
        .expect(201);

      const res = await http()
        .post(`/api/orders/${id}/discount`)
        .set('Cookie', cashier)
        .send({ type: 'percentage', value: 50, reason: 'Descuento imposible' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('por debajo de lo ya cobrado');

      const order = await http().get(`/api/orders/${id}`).set('Cookie', cashier).expect(200);
      expect(Number(order.body.total)).toBeCloseTo(total, 2);
    });

    it('rechaza un descuento mayor que el subtotal', async () => {
      const { id, total } = await openTab();

      const res = await http()
        .post(`/api/orders/${id}/discount`)
        .set('Cookie', cashier)
        .send({ type: 'fixed', value: total + 100, reason: 'Más que la cuenta' });

      expect(res.status).toBe(400);
    });
  });

  describe('idempotencia del cobro', () => {
    it('un pago parcial reenviado con la misma clave no cobra dos veces', async () => {
      // Este era un bug real y alcanzable con dos clics: un pago *completo* repetido se
      // rechazaba de rebote porque la cuenta ya estaba cerrada, pero un pago **parcial**
      // repetido pasaba entero y sumaba — 30 + 30 dejaban 60 cobrados de una cuenta de 100.
      const { id, total } = await openTab();
      const part = Number((total * 0.3).toFixed(2));
      const body = { method: 'cash', amount: part, clientRequestId: 'cola-offline-001' };

      const first = await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send(body)
        .expect(201);
      const second = await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send(body)
        .expect(201);

      expect(first.body.paid).toBeCloseTo(part, 2);
      expect(second.body.paid).toBeCloseTo(part, 2);
      expect(second.body.payments).toHaveLength(1);
    });

    it('reenviar el pago que cerró la cuenta devuelve el estado, no un error', async () => {
      // Sin la comprobación antes de todo lo demás, el reintento chocaría con «la cuenta ya
      // está cerrada»: un fallo falso que dejaría la cola atascada reintentando para siempre
      // algo que ya se aplicó.
      const { id, total } = await openTab();
      const body = { method: 'cash', amount: total, clientRequestId: 'cola-offline-002' };

      await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send(body)
        .expect(201);

      const retry = await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send(body);

      expect(retry.status).toBe(201);
      expect(retry.body.remaining).toBe(0);
      expect(retry.body.payments).toHaveLength(1);
    });

    it('sin clave, dos pagos iguales sí son dos cobros distintos', async () => {
      // La idempotencia es explícita: el POS conectado no manda clave, y dos pagos en
      // efectivo del mismo importe son un caso legítimo, no un duplicado.
      const { id, total } = await openTab();
      const part = Number((total * 0.25).toFixed(2));

      await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send({ method: 'cash', amount: part })
        .expect(201);
      const second = await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send({ method: 'cash', amount: part })
        .expect(201);

      expect(second.body.paid).toBeCloseTo(part * 2, 2);
      expect(second.body.payments).toHaveLength(2);
    });
  });

  describe('arqueo del turno', () => {
    it('cuadra con lo cobrado por cada método', async () => {
      const { id, total } = await openTab();
      const cash = Number((total * 0.4).toFixed(2));
      const card = Number((total - cash).toFixed(2));

      await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send({ method: 'cash', amount: cash })
        .expect(201);
      await http()
        .post(`/api/orders/${id}/payments`)
        .set('Cookie', cashier)
        .send({ method: 'card', amount: card })
        .expect(201);

      // `/shifts/current` ya devuelve el arqueo, no el turno: el turno viene dentro, en
      // `shift`. Pedir el resumen por id es otra forma de llegar al mismo objeto.
      const current = await http()
        .get('/api/shifts/current')
        .set('Cookie', cashier)
        .expect(200);

      const byId = await http()
        .get(`/api/shifts/${current.body.shift.id}/summary`)
        .set('Cookie', cashier)
        .expect(200);

      for (const summary of [current.body, byId.body]) {
        expect(Number(summary.byMethod.cash)).toBeCloseTo(cash, 2);
        expect(Number(summary.byMethod.card)).toBeCloseTo(card, 2);
        expect(Number(summary.totalSales)).toBeCloseTo(total, 2);
        // El efectivo esperado es el fondo inicial más lo cobrado en efectivo.
        expect(Number(summary.expectedCash)).toBeCloseTo(100 + cash, 2);
        // Sin arqueo todavía: la diferencia solo existe cuando el cajero cuenta la caja.
        expect(summary.difference).toBeNull();
      }
    });
  });

  describe('un solo turno abierto por cajero', () => {
    const openShift = () =>
      http().post('/api/shifts/open').set('Cookie', cashier).send({ openingCash: 100 });

    it('la segunda apertura seguida se rechaza', async () => {
      await openShift().expect(201);

      const res = await openShift();

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/turno/i);
    });

    it('dos aperturas simultáneas dejan un solo turno abierto', async () => {
      // La comprobación del servicio es un read-then-write: consulta si hay turno y, si no,
      // lo crea. Entre las dos consultas cabe otra petición, así que un doble clic abría dos
      // turnos — y con dos turnos abiertos el arqueo pierde el sentido, porque los pagos se
      // reparten entre ambos y ninguno cuadra. Lo cierra un índice único parcial.
      const results = await Promise.all([openShift(), openShift(), openShift()]);

      const created = results.filter((r) => r.status === 201);
      expect(created).toHaveLength(1);
      // Las demás fallan, pero ninguna con un 500: el índice se traduce a un error de negocio.
      for (const r of results.filter((r) => r.status !== 201)) {
        expect(r.status).toBe(400);
      }

      const current = await http().get('/api/shifts/current').set('Cookie', cashier).expect(200);
      expect(current.body.shift.id).toBe(created[0].body.shift?.id ?? created[0].body.id);
    });
  });
});
