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

    it('no deja cerrar una cuenta con saldo pendiente', async () => {
      // El agujero que cierra este caso: la vista del mesero pintaba un botón por cada
      // transición permitida, así que en una orden entregada aparecía «Cerrada». Un toque
      // sacaba la cuenta de «Cuentas por cobrar» y liberaba la mesa sin haber cobrado nada.
      const created = await createOrder({
        tableId: table.id,
        items: [{ productId: product.id, quantity: 2 }],
      });
      const id = created.body.id;
      for (const status of ['preparing', 'ready', 'delivered']) {
        await request(app.getHttpServer())
          .patch(`/api/orders/${id}/status`)
          .set('Cookie', cookie)
          .send({ status })
          .expect(200);
      }

      const res = await request(app.getHttpServer())
        .patch(`/api/orders/${id}/status`)
        .set('Cookie', cookie)
        .send({ status: 'closed' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/sin cobrar/i);

      // Y la cuenta sigue viva y la mesa ocupada, no a medio cerrar.
      const after = await request(app.getHttpServer())
        .get(`/api/orders/${id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(after.body.status).toBe('delivered');
      expect(await tableStatus(app, table.id)).toBe('occupied');
    });

    it('sí deja cancelar una cuenta sin cobrar', async () => {
      // Cancelar sigue siendo legítimo: el cliente se fue, la orden estaba mal tomada.
      const created = await createOrder({ items: [{ productId: product.id, quantity: 1 }] });

      await request(app.getHttpServer())
        .patch(`/api/orders/${created.body.id}/status`)
        .set('Cookie', cookie)
        .send({ status: 'cancelled' })
        .expect(200);
    });
  });

  describe('listado', () => {
    /** Crea `n` órdenes y cierra la primera vía cancelación, para tener una no abierta. */
    async function seedOrders(n: number) {
      const ids: string[] = [];
      for (let i = 0; i < n; i++) {
        const res = await createOrder({ items: [{ productId: product.id, quantity: 1 }] });
        ids.push(res.body.id);
      }
      return ids;
    }

    const list = (query = '') =>
      request(app.getHttpServer()).get(`/api/orders${query}`).set('Cookie', cookie);

    it('open=true deja fuera las cerradas y las canceladas', async () => {
      const [first] = await seedOrders(3);
      await request(app.getHttpServer())
        .patch(`/api/orders/${first}/status`)
        .set('Cookie', cookie)
        .send({ status: 'cancelled' })
        .expect(200);

      const res = await list('?open=true').expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.map((o: { id: string }) => o.id)).not.toContain(first);
    });

    it('take acota el tamaño de la respuesta', async () => {
      await seedOrders(4);

      const res = await list('?take=2').expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('rechaza un take por encima del tope en lugar de servirlo', async () => {
      // Un tope que se pueda saltar por la query string no es un tope: sin esto, cachear el
      // listado en el dispositivo volvería a significar traerse el histórico entero.
      await list('?take=5000').expect(400);
    });

    it('skip pagina sin repetir filas', async () => {
      await seedOrders(3);

      const page1 = await list('?take=2').expect(200);
      const page2 = await list('?take=2&skip=2').expect(200);

      expect(page1.body).toHaveLength(2);
      expect(page2.body).toHaveLength(1);
      const ids = [...page1.body, ...page2.body].map((o: { id: string }) => o.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('rechaza un filtro que no existe, en vez de ignorarlo', async () => {
      // `forbidNonWhitelisted` del ValidationPipe: un filtro mal escrito tiene que fallar,
      // no devolver silenciosamente el listado sin filtrar.
      await list('?estado=pending').expect(400);
    });
  });

  // El pipe global corre con `forbidNonWhitelisted`, así que hasta que estos campos se
  // declararon, TODA operación reenviada por la cola sin conexión recibía un 400 — que la
  // cola clasifica como fallo definitivo. La función que se probaba a sí misma mandaba cada
  // comanda diferida directa a la bandeja de fallos.
  describe('la hora del hecho que reporta el dispositivo', () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

    it('acepta occurredAt al crear y lo guarda junto a created_at, sin pisarlo', async () => {
      const at = ago(20 * 60 * 1000);
      const res = await createOrder({
        occurredAt: at,
        items: [{ productId: product.id, quantity: 1, occurredAt: at }],
      }).expect(201);

      // Instantes, nunca cadenas: el arnés fuerza TZ=America/Mexico_City y CI corre en UTC.
      expect(new Date(res.body.occurredAt).getTime()).toBe(new Date(at).getTime());
      expect(new Date(res.body.createdAt).getTime()).toBeGreaterThan(new Date(at).getTime());
      expect(new Date(res.body.statusHistory[0].occurredAt).getTime()).toBe(new Date(at).getTime());
    });

    it('guarda la hora del hecho en el historial al cambiar de estado', async () => {
      const created = await createOrder({
        items: [{ productId: product.id, quantity: 1 }],
      }).expect(201);
      const at = ago(12 * 60 * 1000);

      const res = await request(app.getHttpServer())
        .patch(`/api/orders/${created.body.id}/status`)
        .set('Cookie', cookie)
        .send({ status: 'preparing', occurredAt: at })
        .expect(200);

      const entry = res.body.statusHistory.find(
        (h: { toStatus: string }) => h.toStatus === 'preparing',
      );
      expect(new Date(entry.occurredAt).getTime()).toBe(new Date(at).getTime());
    });

    it('descarta un reloj imposible en lugar de rechazar la comanda', async () => {
      // Una tablet con la fecha mal puesta no puede costar una comanda: el sello se cae, la
      // orden entra.
      const res = await createOrder({
        occurredAt: '2126-01-01T00:00:00.000Z',
        items: [{ productId: product.id, quantity: 1 }],
      }).expect(201);

      expect(res.body.occurredAt).toBeNull();
    });

    it('no rompe las operaciones que no guardan la hora, pero la aceptan', async () => {
      // `updateItem` y `updateItemStatus` no tienen dónde ponerla. Declaran el campo solo para
      // que `forbidNonWhitelisted` no convierta el reenvío en un 400 definitivo.
      const created = await createOrder({
        items: [{ productId: product.id, quantity: 1 }],
      }).expect(201);
      const itemId = created.body.items[0].id;

      await request(app.getHttpServer())
        .patch(`/api/orders/${created.body.id}/items/${itemId}`)
        .set('Cookie', cookie)
        .send({ quantity: 2, occurredAt: ago(60_000) })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/orders/${created.body.id}/items/${itemId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'preparing', occurredAt: ago(60_000) })
        .expect(200);
    });

    it('una operación de mesa vieja no pisa un estado más reciente', async () => {
      // El conflicto que sí es alcanzable: el mesero marca la mesa libre sin red mientras la
      // caja la marca ocupada. Gana el hecho más nuevo, no el que llegue más tarde. Y se
      // responde 200: nadie debe encontrar una entrada en la bandeja de fallos por el color
      // de una mesa.
      const tablesCookie = await sessionAs(app, 'admin@loklflow.com', [
        'tables:read',
        'tables:update',
      ]);
      const patch = (body: Record<string, unknown>) =>
        request(app.getHttpServer())
          .patch(`/api/tables/${table.id}/status`)
          .set('Cookie', tablesCookie)
          .send(body);

      await patch({ status: 'occupied' }).expect(200);
      const res = await patch({ status: 'available', occurredAt: ago(60 * 60 * 1000) }).expect(200);

      expect(res.body.status).toBe('occupied');
      expect(await tableStatus(app, table.id)).toBe('occupied');
    });

    it('una operación de mesa reciente sí se aplica', async () => {
      const tablesCookie = await sessionAs(app, 'admin@loklflow.com', [
        'tables:read',
        'tables:update',
      ]);
      const res = await request(app.getHttpServer())
        .patch(`/api/tables/${table.id}/status`)
        .set('Cookie', tablesCookie)
        .send({ status: 'cleaning', occurredAt: new Date().toISOString() })
        .expect(200);

      expect(res.body.status).toBe('cleaning');
    });
  });
});
