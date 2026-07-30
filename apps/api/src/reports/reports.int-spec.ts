import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, sessionAs } from '../../test/fixtures';
import { PAYMENT_METHODS } from '../payments/payment-method.constants';
import { toUtcTimestamp } from './utc-timestamp';

/**
 * Los reportes contra una base real. El test unitario de `toUtcTimestamp` comprueba el
 * formato de la cadena, pero no lo que de verdad se rompió: que la comparación de rangos
 * en SQL descartaba filas.
 *
 * La suite corre con TZ=America/Mexico_City (lo fija `test/env.ts`), así que la hora local
 * del proceso está desplazada respecto al UTC que guarda Postgres. Sin ese desplazamiento
 * estos casos pasarían aunque el bug volviera.
 */
describe('Reportes', () => {
  let app: INestApplication;
  let ds: DataSource;
  let cookie: string;
  let cashier: string;
  let waiter: string;
  let product: { id: string; price: number };

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    cookie = await sessionAs(app, 'admin@loklflow.com', ['pos:read']);
    cashier = await sessionAs(app, 'cajero@loklflow.com', ['pos:create', 'pos:read']);
    waiter = await sessionAs(app, 'mesero@loklflow.com', ['orders:create']);
    product = await firstProduct(app);
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  /** Cuenta cobrada por completo, con el turno abierto. Devuelve el importe. */
  async function paidOrder(quantity = 2): Promise<{ paymentId: string; amount: number }> {
    await http()
      .post('/api/shifts/open')
      .set('Cookie', cashier)
      .send({ openingCash: 0 })
      .expect(201);

    const order = await http()
      .post('/api/orders')
      .set('Cookie', waiter)
      .send({ items: [{ productId: product.id, quantity }] })
      .expect(201);

    const amount = Number(order.body.total);
    await http()
      .post(`/api/orders/${order.body.id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'cash', amount })
      .expect(201);

    const [row]: { id: string }[] = await ds.query(
      `SELECT id FROM payments WHERE order_id = $1`,
      [order.body.id],
    );
    return { paymentId: row.id, amount };
  }

  it('la suite corre en una zona desplazada respecto a UTC', () => {
    // Si esto fallara, los dos casos siguientes dejarían de probar el bug de zona horaria.
    expect(new Date().getTimezoneOffset()).not.toBe(0);
  });

  it('cuenta un cobro de la madrugada dentro del día en curso', async () => {
    const { amount } = await paidOrder();

    // 00:30 de hoy en hora local. Es la franja que desaparecía: con el proceso en GMT-5,
    // el límite inferior del rango se enviaba desplazado cinco horas y esta fila quedaba
    // fuera por poco.
    const localEarly = new Date();
    localEarly.setHours(0, 30, 0, 0);
    await ds.query(`UPDATE payments SET processed_at = $1`, [toUtcTimestamp(localEarly)]);

    const res = await http()
      .get('/api/reports/sales-summary')
      .set('Cookie', cookie)
      .expect(200);

    expect(Number(res.body.totalSales)).toBeCloseTo(amount, 2);
    expect(Number(res.body.paymentsCount)).toBe(1);
  });

  it('cuenta también un cobro del último minuto de la noche', async () => {
    const { amount } = await paidOrder();

    const localLate = new Date();
    localLate.setHours(23, 59, 30, 0);
    await ds.query(`UPDATE payments SET processed_at = $1`, [toUtcTimestamp(localLate)]);

    const res = await http()
      .get('/api/reports/sales-summary')
      .set('Cookie', cookie)
      .expect(200);

    expect(Number(res.body.totalSales)).toBeCloseTo(amount, 2);
  });

  it('deja fuera un cobro de ayer', async () => {
    await paidOrder();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    await ds.query(`UPDATE payments SET processed_at = $1`, [toUtcTimestamp(yesterday)]);

    const res = await http()
      .get('/api/reports/sales-summary')
      .set('Cookie', cookie)
      .expect(200);

    expect(Number(res.body.totalSales)).toBe(0);
    expect(Number(res.body.paymentsCount)).toBe(0);
  });

  it('devuelve todos los métodos de pago, también los que valen cero', async () => {
    await paidOrder();

    const res = await http()
      .get('/api/reports/sales-summary')
      .set('Cookie', cookie)
      .expect(200);

    // El frontend itera sin defensas, así que las claves tienen que estar siempre.
    expect(Object.keys(res.body.byMethod).sort()).toEqual(
      [...PAYMENT_METHODS].sort(),
    );
  });

  it('agrega el ticket promedio sobre las cuentas cerradas', async () => {
    const { amount } = await paidOrder();

    const res = await http()
      .get('/api/reports/sales-summary')
      .set('Cookie', cookie)
      .expect(200);

    expect(Number(res.body.ordersClosed)).toBe(1);
    expect(Number(res.body.averageTicket)).toBeCloseTo(amount, 2);
  });

  it('lista los productos más vendidos con su cantidad', async () => {
    await paidOrder(3);

    const res = await http()
      .get('/api/reports/top-products')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body[0]).toMatchObject({ productId: product.id, quantity: 3 });
  });

  it('mide el tiempo de preparación a partir del historial de estados', async () => {
    const order = await http()
      .post('/api/orders')
      .set('Cookie', waiter)
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);

    const updater = await sessionAs(app, 'cocina@loklflow.com', ['orders:update']);
    for (const status of ['preparing', 'ready']) {
      await http()
        .patch(`/api/orders/${order.body.id}/status`)
        .set('Cookie', updater)
        .send({ status })
        .expect(200);
    }

    const res = await http()
      .get('/api/reports/prep-times')
      .set('Cookie', cookie)
      .expect(200);

    // Es la primera lectura de order_status_history: se escribía desde el principio y
    // nadie la consultaba, así que un cambio de forma ahí pasaría inadvertido.
    expect(res.body.sampleSize).toBe(1);
    expect(res.body.averageMinutes).not.toBeNull();
    expect(res.body.averageMinutes).toBeGreaterThanOrEqual(0);
  });

  describe('exportación a CSV', () => {
    it('sale con BOM, CRLF y una fila por pago', async () => {
      await paidOrder();

      const res = await http()
        .get('/api/reports/sales.csv')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('.csv');

      const text = res.text ?? res.body.toString();
      // El BOM es lo que evita que Excel en Windows destroce los acentos.
      expect(text.charCodeAt(0)).toBe(0xfeff);
      expect(text).toContain('\r\n');
      // Cabecera más un pago.
      expect(text.trimEnd().split('\r\n')).toHaveLength(2);
    });
  });
});
