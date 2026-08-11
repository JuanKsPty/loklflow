import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, sessionAs } from '../../test/fixtures';

/**
 * Turnos de caja.
 *
 * El caso que justifica el archivo es el primero: **dos aperturas simultáneas**. CLAUDE.md
 * documenta el incidente —un doble clic abría dos turnos, los pagos se repartían entre ambos y
 * ninguno cuadraba— y el arreglo fue el índice parcial `idx_shifts_one_open_per_user`. Hasta
 * ahora nada comprobaba que ese índice hiciera su trabajo: la comprobación del servicio es un
 * read-then-write y pasaría igual sin él.
 */
describe('Turnos de caja', () => {
  let app: INestApplication;
  let ds: DataSource;
  let cashier: string;
  let otherCashier: string;
  let waiter: string;
  let product: { id: string; price: number };

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    cashier = await sessionAs(app, 'cajero@loklflow.com', ['pos:create', 'pos:read']);
    otherCashier = await sessionAs(app, 'admin@loklflow.com', ['pos:create', 'pos:read']);
    waiter = await sessionAs(app, 'mesero@loklflow.com', ['orders:create', 'orders:read']);
    product = await firstProduct(app);
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  async function open(cookie = cashier, openingCash = 100) {
    const res = await http()
      .post('/api/shifts/open')
      .set('Cookie', cookie)
      .send({ openingCash })
      .expect(201);
    return res.body.shift.id as string;
  }

  /** Cobra `amount` con `method` sobre una cuenta nueva. */
  async function charge(method: string, amount: number, quantity = 10) {
    const order = await http()
      .post('/api/orders')
      .set('Cookie', waiter)
      .send({ items: [{ productId: product.id, quantity }] })
      .expect(201);

    await http()
      .post(`/api/orders/${order.body.id}/payments`)
      .set('Cookie', cashier)
      .send({ method, amount })
      .expect(201);
  }

  /**
   * Dos aperturas a la vez, de verdad en paralelo. El `Promise.all` es el punto: en secuencia
   * bastaría la comprobación del servicio y el test pasaría con el índice borrado.
   */
  it('dos aperturas simultáneas dejan un solo turno abierto', async () => {
    const [a, b] = await Promise.all([
      http().post('/api/shifts/open').set('Cookie', cashier).send({ openingCash: 100 }),
      http().post('/api/shifts/open').set('Cookie', cashier).send({ openingCash: 100 }),
    ]);

    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([201, 400]);

    const rows = await ds.query(
      `SELECT count(*)::int AS n FROM shifts WHERE status = 'open'`,
    );
    expect(rows[0].n).toBe(1);

    // Y el que perdió la carrera no sale como un 500 de la base: es un error de negocio.
    const perdedor = a.status === 400 ? a : b;
    expect(String(perdedor.body.message)).toMatch(/turno de caja abierto/i);
  });

  it('un segundo intento, ya en secuencia, también se rechaza', async () => {
    await open();
    const res = await http()
      .post('/api/shifts/open')
      .set('Cookie', cashier)
      .send({ openingCash: 100 })
      .expect(400);
    expect(String(res.body.message)).toMatch(/turno de caja abierto/i);
  });

  /** El índice es **por usuario**: dos cajeros a la vez es la operación normal de un local. */
  it('dos cajeros distintos pueden tener turno abierto a la vez', async () => {
    await open(cashier);
    await open(otherCashier, 50);

    const rows = await ds.query(`SELECT count(*)::int AS n FROM shifts WHERE status = 'open'`);
    expect(rows[0].n).toBe(2);
  });

  it('sin turno abierto, /current devuelve null', async () => {
    const res = await http().get('/api/shifts/current').set('Cookie', cashier).expect(200);
    expect(res.body).toEqual({});
  });

  it('/current devuelve el arqueo en vivo del turno propio', async () => {
    await open(cashier, 100);
    await charge('cash', 50);

    const res = await http().get('/api/shifts/current').set('Cookie', cashier).expect(200);

    expect(res.body).toMatchObject({
      cashSales: 50,
      expectedCash: 150,
      countedCash: null,
      difference: null,
      paymentsCount: 1,
    });
  });

  it('el arqueo separa efectivo de tarjeta y solo el efectivo cuenta para el cajón', async () => {
    const id = await open(cashier, 100);
    await charge('cash', 50);
    await charge('card', 200);

    const res = await http().get(`/api/shifts/${id}/summary`).set('Cookie', cashier).expect(200);

    expect(res.body.byMethod).toMatchObject({ cash: 50, card: 200 });
    expect(res.body.totalSales).toBe(250);
    expect(res.body.expectedCash).toBe(150);
  });

  it('cerrar con lo esperado deja la diferencia en cero', async () => {
    const id = await open(cashier, 100);
    await charge('cash', 50);

    const res = await http()
      .post(`/api/shifts/${id}/close`)
      .set('Cookie', cashier)
      .send({ closingCash: 150 })
      .expect(201);

    expect(res.body).toMatchObject({
      countedCash: 150,
      expectedCash: 150,
      difference: 0,
      totalSales: 50,
    });
    expect(res.body.shift.status).toBe('closed');
  });

  it('un faltante sale negativo', async () => {
    const id = await open(cashier, 100);
    await charge('cash', 50);

    const res = await http()
      .post(`/api/shifts/${id}/close`)
      .set('Cookie', cashier)
      .send({ closingCash: 130 })
      .expect(201);

    expect(res.body.difference).toBe(-20);
  });

  it('el arqueo del cierre queda en la bitácora', async () => {
    // Es el dato que se revisa cuando la caja no cuadra; sin él, cerrar no deja rastro.
    const id = await open(cashier, 100);
    await charge('cash', 50);
    await http()
      .post(`/api/shifts/${id}/close`)
      .set('Cookie', cashier)
      .send({ closingCash: 130, notes: 'faltan 20' })
      .expect(201);

    const rows = await ds.query(
      `SELECT new_value FROM audit_logs WHERE action = 'shift.closed' AND entity_id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].new_value).toMatchObject({ difference: -20, expectedCash: 150 });
  });

  it('un turno cerrado no se cierra dos veces', async () => {
    const id = await open();
    await http()
      .post(`/api/shifts/${id}/close`)
      .set('Cookie', cashier)
      .send({ closingCash: 100 })
      .expect(201);

    const res = await http()
      .post(`/api/shifts/${id}/close`)
      .set('Cookie', cashier)
      .send({ closingCash: 100 })
      .expect(400);
    expect(String(res.body.message)).toMatch(/ya está cerrado/i);
  });

  /** El arqueo es personal: cerrar la caja de otro es firmar un recuento que no hiciste. */
  it('nadie cierra el turno de otro', async () => {
    const id = await open(cashier);

    const res = await http()
      .post(`/api/shifts/${id}/close`)
      .set('Cookie', otherCashier)
      .send({ closingCash: 100 })
      .expect(400);
    expect(String(res.body.message)).toMatch(/tu propio turno/i);
  });

  it('cerrar uno que no existe da 404', async () => {
    await http()
      .post('/api/shifts/00000000-0000-4000-8000-000000000999/close')
      .set('Cookie', cashier)
      .send({ closingCash: 100 })
      .expect(404);
  });

  it('tras cerrar se puede abrir otro', async () => {
    const id = await open();
    await http()
      .post(`/api/shifts/${id}/close`)
      .set('Cookie', cashier)
      .send({ closingCash: 100 })
      .expect(201);

    await open();
  });

  it('el listado es solo del propio usuario', async () => {
    await open(cashier);
    await open(otherCashier, 50);

    const mios = await http().get('/api/shifts').set('Cookie', cashier).expect(200);
    expect(mios.body).toHaveLength(1);
    expect(Number(mios.body[0].openingCash)).toBe(100);
  });

  it('un fondo de caja negativo se rechaza', async () => {
    await http()
      .post('/api/shifts/open')
      .set('Cookie', cashier)
      .send({ openingCash: -1 })
      .expect(400);
  });

  it('exige permiso de caja', async () => {
    const sinPermiso = await sessionAs(app, 'mesero@loklflow.com', ['orders:read']);
    await http()
      .post('/api/shifts/open')
      .set('Cookie', sinPermiso)
      .send({ openingCash: 100 })
      .expect(403);
  });
});
