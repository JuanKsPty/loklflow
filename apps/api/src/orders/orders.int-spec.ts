import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, firstTable, sessionAs, tableStatus } from '../../test/fixtures';

describe('Órdenes de punta a punta', () => {
  let app: INestApplication;
  let cookie: string;
  let product: { id: string; price: number };
  let table: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    cookie = await sessionAs(app, 'mesero@loklflow.com', [
      'orders:create',
      'orders:read',
      'orders:update',
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

  const createOrder = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/orders').set('Cookie', cookie).send(body);

  it('calcula el subtotal y el total en el servidor', async () => {
    const res = await createOrder({ items: [{ productId: product.id, quantity: 3 }] });

    expect(res.status).toBe(201);
    expect(Number(res.body.subtotal)).toBeCloseTo(product.price * 3, 2);
    expect(Number(res.body.discountAmount)).toBe(0);
    expect(Number(res.body.tipAmount)).toBe(0);
    expect(Number(res.body.total)).toBeCloseTo(product.price * 3, 2);
    expect(res.body.status).toBe('pending');
  });

  it('deja el primer estado en el historial de transiciones', async () => {
    const res = await createOrder({ items: [{ productId: product.id, quantity: 1 }] });

    expect(res.body.statusHistory).toHaveLength(1);
    expect(res.body.statusHistory[0]).toMatchObject({ fromStatus: null, toStatus: 'pending' });
  });

  it('ocupa la mesa al abrirle una cuenta', async () => {
    expect(await tableStatus(app, table.id)).toBe('available');

    await createOrder({ tableId: table.id, items: [{ productId: product.id, quantity: 1 }] });

    expect(await tableStatus(app, table.id)).toBe('occupied');
  });

  it('recalcula el total al añadir un ítem', async () => {
    const created = await createOrder({ items: [{ productId: product.id, quantity: 1 }] });

    const res = await request(app.getHttpServer())
      .post(`/api/orders/${created.body.id}/items`)
      .set('Cookie', cookie)
      .send({ productId: product.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(Number(res.body.subtotal)).toBeCloseTo(product.price * 3, 2);
    expect(Number(res.body.total)).toBeCloseTo(product.price * 3, 2);
  });

  it('rechaza un producto que no existe', async () => {
    const res = await createOrder({
      items: [{ productId: '22222222-2222-4222-8222-222222222222', quantity: 1 }],
    });
    expect(res.status).toBe(400);
  });

  describe('numeración', () => {
    it('asigna números distintos a órdenes creadas en paralelo', async () => {
      // El caso que importa: dos meseros tomando nota a la vez. La numeración salía de un
      // MAX(order_number)+1 leído fuera de transacción, así que dos peticiones simultáneas
      // podían calcular el mismo número.
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          createOrder({ items: [{ productId: product.id, quantity: 1 }] }),
        ),
      );

      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      const numbers = responses.map((r) => r.body.orderNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
    });
  });

  describe('ids generados en el dispositivo', () => {
    /** uuid v4 válido y distinto en cada llamada: lo que generaría el dispositivo. */
    const uuid = () => {
      const hex = (n: number) =>
        Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      return `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
    };

    it('usa el uuid que manda el cliente como clave primaria', async () => {
      const id = uuid();
      const res = await createOrder({ id, items: [{ productId: product.id, quantity: 1 }] });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(id);
    });

    it('reenviar la creación devuelve la misma orden, no una segunda', async () => {
      const id = uuid();
      const body = { id, items: [{ productId: product.id, quantity: 2 }] };

      const first = await createOrder(body);
      const second = await createOrder(body);

      expect(first.body.id).toBe(id);
      expect(second.body.id).toBe(id);
      // Y sobre todo: el mismo número de cuenta, no dos.
      expect(second.body.orderNumber).toBe(first.body.orderNumber);

      const [{ count }]: { count: string }[] = await app
        .get(DataSource)
        .query('SELECT count(*) FROM orders');
      expect(Number(count)).toBe(1);
    });

    it('un reenvío no vuelve a sumar los ítems al total', async () => {
      const id = uuid();
      const body = { id, items: [{ productId: product.id, quantity: 2 }] };

      const first = await createOrder(body);
      const second = await createOrder(body);

      expect(Number(second.body.total)).toBeCloseTo(Number(first.body.total), 2);
      expect(second.body.items).toHaveLength(1);
    });

    it('aguanta varios reenvíos simultáneos del mismo id', async () => {
      // El caso feo: la tablea recupera conexión y la cola manda el mismo alta varias veces
      // a la vez. Ninguna debe fallar, y solo puede quedar una orden.
      const id = uuid();
      const body = { id, items: [{ productId: product.id, quantity: 1 }] };

      const responses = await Promise.all(Array.from({ length: 5 }, () => createOrder(body)));

      for (const res of responses) {
        expect([200, 201]).toContain(res.status);
        expect(res.body.id).toBe(id);
      }

      const [{ count }]: { count: string }[] = await app
        .get(DataSource)
        .query('SELECT count(*) FROM orders');
      expect(Number(count)).toBe(1);
    });

    it('reenviar un ítem con el mismo id no lo cobra dos veces', async () => {
      const created = await createOrder({ items: [{ productId: product.id, quantity: 1 }] });
      const itemId = uuid();
      const body = { id: itemId, productId: product.id, quantity: 3 };

      const first = await request(app.getHttpServer())
        .post(`/api/orders/${created.body.id}/items`)
        .set('Cookie', cookie)
        .send(body);
      const second = await request(app.getHttpServer())
        .post(`/api/orders/${created.body.id}/items`)
        .set('Cookie', cookie)
        .send(body);

      expect(Number(first.body.total)).toBeCloseTo(product.price * 4, 2);
      expect(Number(second.body.total)).toBeCloseTo(product.price * 4, 2);
      expect(second.body.items).toHaveLength(2);
    });
  });

  describe('flujo de estados', () => {
    it('avanza por las transiciones permitidas', async () => {
      const created = await createOrder({ items: [{ productId: product.id, quantity: 1 }] });
      const id = created.body.id;

      for (const status of ['preparing', 'ready', 'delivered']) {
        const res = await request(app.getHttpServer())
          .patch(`/api/orders/${id}/status`)
          .set('Cookie', cookie)
          .send({ status });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
    });

    it('rechaza un salto que no está permitido', async () => {
      const created = await createOrder({ items: [{ productId: product.id, quantity: 1 }] });

      const res = await request(app.getHttpServer())
        .patch(`/api/orders/${created.body.id}/status`)
        .set('Cookie', cookie)
        .send({ status: 'delivered' });

      expect(res.status).toBe(400);
    });
  });
});
