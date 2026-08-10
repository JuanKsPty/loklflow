import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, sessionAs, tableStatus } from '../../test/fixtures';

/**
 * Fusión de cuentas entre mesas.
 *
 * Es lógica que mueve dinero de una cuenta a otra, así que el int-spec no es opcional. El caso que
 * de verdad justifica el archivo es el de los reportes: olvidar el filtro en **una sola** de las
 * consultas agregadas duplica las ventas del día, y es un fallo que no rompe nada visible — solo
 * hace que los números del dueño estén mal.
 */
describe('fusión de cuentas', () => {
  let app: INestApplication;
  let ds: DataSource;
  let waiter: string;
  let cashier: string;
  let admin: string;
  let product: { id: string; price: number };
  let tables: { id: string; number: number }[];

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    waiter = await sessionAs(app, 'mesero@loklflow.com', [
      'orders:create',
      'orders:read',
      'orders:update',
    ]);
    cashier = await sessionAs(app, 'cajero@loklflow.com', [
      'pos:create',
      'pos:read',
      'orders:read',
      'orders:update',
    ]);
    admin = await sessionAs(app, 'admin@loklflow.com', ['pos:read', 'orders:read']);
    product = await firstProduct(app);

    const res = await request(app.getHttpServer())
      .get('/api/tables')
      .set('Cookie', await sessionAs(app, 'admin@loklflow.com', ['tables:read']))
      .expect(200);
    tables = res.body as typeof tables;
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  async function openOrder(tableIndex: number, quantity = 1) {
    const res = await http()
      .post('/api/orders')
      .set('Cookie', waiter)
      .send({
        tableId: tables[tableIndex].id,
        items: [{ productId: product.id, quantity }],
      })
      .expect(201);
    return res.body as { id: string; orderNumber: number; total: number };
  }

  const merge = (targetId: string, sourceIds: string[], as = waiter) =>
    http().post(`/api/orders/${targetId}/merge`).set('Cookie', as).send({ sourceOrderIds: sourceIds });

  const getOrder = async (id: string) =>
    (await http().get(`/api/orders/${id}`).set('Cookie', waiter).expect(200)).body;

  it('mueve los ítems a la cuenta destino y recalcula los dos totales', async () => {
    const destino = await openOrder(0, 2);
    const origen = await openOrder(1, 3);

    await merge(destino.id, [origen.id]).expect(201);

    const target = await getOrder(destino.id);
    expect(target.items).toHaveLength(2);
    expect(Number(target.total)).toBeCloseTo(product.price * 5, 2);
  });

  it('la cuenta origen queda a cero y apuntando a la destino', async () => {
    const destino = await openOrder(0);
    const origen = await openOrder(1);

    await merge(destino.id, [origen.id]).expect(201);

    const source = await getOrder(origen.id);
    expect(source.items).toHaveLength(0);
    expect(Number(source.total)).toBe(0);
    expect(source.mergedIntoOrderId).toBe(destino.id);
    // El estado **no** se toca: `closed` sería mentira (no se cobró) y `cancelled` ensuciaría la
    // auditoría de cancelaciones. La exclusión cuelga de `mergedIntoOrderId`.
    expect(source.status).toBe('pending');
  });

  it('el listado de cuentas abiertas ya no la devuelve', async () => {
    const destino = await openOrder(0);
    const origen = await openOrder(1);
    await merge(destino.id, [origen.id]).expect(201);

    const res = await http().get('/api/orders?open=true').set('Cookie', waiter).expect(200);
    const ids = (res.body as { id: string }[]).map((o) => o.id);

    expect(ids).toContain(destino.id);
    expect(ids).not.toContain(origen.id);
  });

  it('pero su detalle sigue abriéndose: la bitácora enlaza a ella', async () => {
    const destino = await openOrder(0);
    const origen = await openOrder(1);
    await merge(destino.id, [origen.id]).expect(201);

    await http().get(`/api/orders/${origen.id}`).set('Cookie', waiter).expect(200);
  });

  it('libera la mesa de la cuenta origen', async () => {
    const destino = await openOrder(0);
    const origen = await openOrder(1);
    expect(await tableStatus(app, tables[1].id)).toBe('occupied');

    await merge(destino.id, [origen.id]).expect(201);

    // El resultado visible: juntar la 4 y la 5 deja una de las dos libre.
    expect(await tableStatus(app, tables[1].id)).toBe('available');
    expect(await tableStatus(app, tables[0].id)).toBe('occupied');
  });

  describe('lo que rechaza', () => {
    it('una cuenta con pagos registrados, diciendo cuál', async () => {
      const destino = await openOrder(0);
      const origen = await openOrder(1);
      await http()
        .post('/api/shifts/open')
        .set('Cookie', cashier)
        .send({ openingCash: 100 })
        .expect((r) => [201, 400].includes(r.status));
      await http()
        .post(`/api/orders/${origen.id}/payments`)
        .set('Cookie', cashier)
        .send({ method: 'cash', amount: 1 })
        .expect(201);

      const res = await merge(destino.id, [origen.id]).expect(400);

      expect(res.body.message).toContain(`#${origen.orderNumber}`);
      expect(res.body.message).toMatch(/pagos/i);
    });

    it('una cuenta cerrada', async () => {
      const destino = await openOrder(0);
      const origen = await openOrder(1);
      for (const status of ['preparing', 'ready', 'delivered', 'cancelled']) {
        await http()
          .patch(`/api/orders/${origen.id}/status`)
          .set('Cookie', waiter)
          .send({ status })
          .expect(200);
      }

      await merge(destino.id, [origen.id]).expect(400);
    });

    it('fusionar una cuenta consigo misma', async () => {
      const uno = await openOrder(0);

      await merge(uno.id, [uno.id]).expect(400);
    });

    it('fusionar sobre una cuenta que a su vez está fusionada', async () => {
      const a = await openOrder(0);
      const b = await openOrder(1);
      const c = await openOrder(2);
      await merge(a.id, [b.id]).expect(201);

      await merge(b.id, [c.id]).expect(400);
    });

    it('sin orders:update', async () => {
      const destino = await openOrder(0);
      const origen = await openOrder(1);
      const soloLectura = await sessionAs(app, 'mesero@loklflow.com', ['orders:read']);

      await merge(destino.id, [origen.id], soloLectura).expect(403);
    });

    it('cobrar una cuenta fusionada', async () => {
      const destino = await openOrder(0);
      const origen = await openOrder(1);
      await merge(destino.id, [origen.id]).expect(201);
      await http()
        .post('/api/shifts/open')
        .set('Cookie', cashier)
        .send({ openingCash: 100 })
        .expect((r) => [201, 400].includes(r.status));

      const res = await http()
        .post(`/api/orders/${origen.id}/payments`)
        .set('Cookie', cashier)
        .send({ method: 'cash', amount: 10 })
        .expect(400);

      expect(res.body.message).toMatch(/fusionó/i);
    });

    it('añadir ítems a una cuenta fusionada', async () => {
      const destino = await openOrder(0);
      const origen = await openOrder(1);
      await merge(destino.id, [origen.id]).expect(201);

      await http()
        .post(`/api/orders/${origen.id}/items`)
        .set('Cookie', waiter)
        .send({ productId: product.id, quantity: 1 })
        .expect(400);
    });
  });

  /**
   * **El caso que justifica este archivo.**
   *
   * Las cuentas fusionadas siguen existiendo en la tabla, así que cualquier agregado que las cuente
   * suma sus ítems dos veces: una por la cuenta vacía y otra por la que ahora los tiene. Un olvido
   * en una sola de las consultas de `reports.service.ts` infla las ventas del día sin romper nada
   * visible.
   */
  it('los reportes no cuentan dos veces lo fusionado', async () => {
    const destino = await openOrder(0, 2);
    const origen = await openOrder(1, 3);
    await merge(destino.id, [origen.id]).expect(201);

    const summary = await http()
      .get('/api/reports/sales-summary')
      .set('Cookie', admin)
      .expect(200);

    // Una sola cuenta abierta, con las cinco unidades.
    expect(summary.body.openOrders).toBe(1);
    expect(Number(summary.body.openOrdersValue)).toBeCloseTo(product.price * 5, 2);

    const top = await http().get('/api/reports/top-products').set('Cookie', admin).expect(200);
    const row = (top.body as { productId: string; quantity: string }[]).find(
      (r) => r.productId === product.id,
    );
    expect(Number(row?.quantity)).toBe(5);
  });

  describe('deshacer', () => {
    it('devuelve exactamente las líneas que vinieron de esa cuenta', async () => {
      const destino = await openOrder(0, 2);
      const origen = await openOrder(1, 3);
      await merge(destino.id, [origen.id]).expect(201);

      await http().post(`/api/orders/${origen.id}/unmerge`).set('Cookie', waiter).expect(201);

      const restored = await getOrder(origen.id);
      const target = await getOrder(destino.id);
      expect(restored.items).toHaveLength(1);
      expect(Number(restored.total)).toBeCloseTo(product.price * 3, 2);
      // La destino se queda con las suyas y solo con las suyas.
      expect(target.items).toHaveLength(1);
      expect(Number(target.total)).toBeCloseTo(product.price * 2, 2);
      expect(restored.mergedIntoOrderId).toBeNull();
    });

    it('vuelve a ocupar la mesa', async () => {
      const destino = await openOrder(0);
      const origen = await openOrder(1);
      await merge(destino.id, [origen.id]).expect(201);
      expect(await tableStatus(app, tables[1].id)).toBe('available');

      await http().post(`/api/orders/${origen.id}/unmerge`).set('Cookie', waiter).expect(201);

      expect(await tableStatus(app, tables[1].id)).toBe('occupied');
    });

    it('una cuenta que no está fusionada no se puede deshacer', async () => {
      const suelta = await openOrder(0);

      await http().post(`/api/orders/${suelta.id}/unmerge`).set('Cookie', waiter).expect(400);
    });
  });
});
