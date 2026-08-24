import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, sessionAs } from '../../test/fixtures';

/**
 * La venta de mostrador: elegir productos, cobrar y cerrar en una sola petición.
 *
 * Se compone en el servidor porque un teléfono con datos flojos puede dejar la orden creada y el
 * cobro no, y eso es una cuenta abierta que nadie sabe que existe. Lo que esta suite protege es
 * justamente eso: que reenviarla no duplique nada, que sin turno no deje basura, y que no suene en
 * la cocina.
 */
describe('Venta de mostrador', () => {
  let app: INestApplication;
  let ds: DataSource;
  let vendedor: string;
  let admin: string;
  let product: { id: string; price: number };
  let cocina: { id: string; price: number };

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    vendedor = await sessionAs(app, 'admin@loklflow.com', [
      'orders:create',
      'orders:read',
      'pos:create',
      'pos:read',
      'inventory:read',
      'inventory:update',
    ]);
    admin = vendedor;
    product = await firstProduct(app);
    cocina = await productoDeCocina();
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  /** Un producto que se prepara en cocina, para el caso del aviso. */
  async function productoDeCocina(): Promise<{ id: string; price: number }> {
    const rows = await ds.query(
      `SELECT id, price FROM products WHERE station = 'kitchen' AND is_active = true
        ORDER BY name LIMIT 1`,
    );
    return { id: rows[0].id as string, price: Number(rows[0].price) };
  }

  /** Abre el turno y devuelve su id, que es lo que pide el arqueo. */
  async function abrirTurno(): Promise<string> {
    const res = await http()
      .post('/api/shifts/open')
      .set('Cookie', vendedor)
      .send({ openingCash: 0 })
      .expect(201);
    // `openShift` devuelve el **arqueo**, no el turno: el id va dentro de `shift`.
    return res.body.shift.id as string;
  }

  function vender(body: Record<string, unknown> = {}) {
    return http()
      .post('/api/orders/quick-sale')
      .set('Cookie', vendedor)
      .send({
        id: randomUUID(),
        items: [{ productId: product.id, quantity: 2 }],
        payment: { method: 'cash' },
        ...body,
      });
  }

  it('crea la cuenta, la cobra entera y la deja cerrada en una sola petición', async () => {
    await abrirTurno();
    const res = await vender().expect(201);

    const { order, payment } = res.body;
    expect(order.status).toBe('closed');
    expect(payment.remaining).toBe(0);
    expect(payment.paid).toBe(Number(order.total));
  });

  it('la cuenta queda sin mesa, con etiqueta «Mostrador» y origen counter', async () => {
    await abrirTurno();
    const { body } = await vender().expect(201);

    expect(body.order.tableId).toBeNull();
    expect(body.order.label).toBe('Mostrador');
    expect(body.order.source).toBe('counter');
  });

  it('cobra el precio del catálogo, no uno que venga en el cuerpo', async () => {
    await abrirTurno();
    // El DTO ni siquiera acepta `amount`: `forbidNonWhitelisted` lo rechaza.
    await vender({ payment: { method: 'cash', amount: 1 } }).expect(400);

    const { body } = await vender().expect(201);
    expect(Number(body.order.total)).toBe(Number((product.price * 2).toFixed(2)));
  });

  it('descuenta las existencias propias del producto vendido', async () => {
    await abrirTurno();
    await http()
      .put(`/api/inventory/products/${product.id}/stock`)
      .set('Cookie', admin)
      .send({ newStock: 20, reasonCode: 'count' })
      .expect(200);

    await vender().expect(201);

    const [{ current_stock: stock }] = await ds.query(
      `SELECT current_stock FROM ingredients WHERE product_id = $1`,
      [product.id],
    );
    expect(Number(stock)).toBe(18);
  });

  describe('idempotencia', () => {
    it('reenviarla con el mismo id no cobra dos veces', async () => {
      await abrirTurno();
      const id = randomUUID();

      const primera = await vender({ id }).expect(201);
      const segunda = await vender({ id }).expect(201);

      expect(segunda.body.order.id).toBe(primera.body.order.id);
      expect(segunda.body.order.orderNumber).toBe(primera.body.order.orderNumber);
      expect(segunda.body.payment.payments).toHaveLength(1);
    });

    it('ni descuenta dos veces', async () => {
      await abrirTurno();
      await http()
        .put(`/api/inventory/products/${product.id}/stock`)
        .set('Cookie', admin)
        .send({ newStock: 20, reasonCode: 'count' })
        .expect(200);

      const id = randomUUID();
      await vender({ id }).expect(201);
      await vender({ id }).expect(201);

      const [{ current_stock: stock }] = await ds.query(
        `SELECT current_stock FROM ingredients WHERE product_id = $1`,
        [product.id],
      );
      expect(Number(stock)).toBe(18);
    });

    it('un reenvío con otra clave de pago devuelve la venta, no un error de cuenta cerrada', async () => {
      // Un cliente que regenera su `clientRequestId` llegaría a `addPayment` sobre una cuenta ya
      // cerrada y vería un error sobre una venta que sí se hizo.
      await abrirTurno();
      const id = randomUUID();

      await vender({ id, clientRequestId: 'uno' }).expect(201);
      const segunda = await vender({ id, clientRequestId: 'dos' }).expect(201);

      expect(segunda.body.order.status).toBe('closed');
      expect(segunda.body.payment.payments).toHaveLength(1);
    });

    it('dos envíos simultáneos dejan un solo cobro', async () => {
      await abrirTurno();
      const id = randomUUID();

      await Promise.all([vender({ id }), vender({ id })]);

      const [{ count }] = await ds.query(
        `SELECT COUNT(*)::int AS count FROM payments p
           JOIN orders o ON o.id = p.order_id WHERE o.id = $1`,
        [id],
      );
      expect(count).toBe(1);
    });
  });

  describe('reglas', () => {
    it('sin turno de caja abierto responde 400 y no deja ninguna orden creada', async () => {
      const id = randomUUID();
      const res = await vender({ id }).expect(400);
      expect(res.body.message).toMatch(/turno/i);

      const filas = await ds.query(`SELECT id FROM orders WHERE id = $1`, [id]);
      expect(filas).toHaveLength(0);
    });

    it('no avisa a Cocina aunque el producto se prepare en cocina', async () => {
      await abrirTurno();
      await vender({ items: [{ productId: cocina.id, quantity: 1 }] }).expect(201);

      const avisos = await ds.query(
        `SELECT id FROM notifications WHERE type = 'order_new'`,
      );
      expect(avisos).toHaveLength(0);
    });

    it('`POST /orders` sigue rechazando source: counter', async () => {
      // Si se pudiera pedir, un mesero podría esconder una comanda del tablero de cocina.
      await http()
        .post('/api/orders')
        .set('Cookie', vendedor)
        .send({ source: 'counter', items: [{ productId: product.id, quantity: 1 }] })
        .expect(400);
    });

    it('el cobro entra en el arqueo del turno de quien vendió', async () => {
      const turno = await abrirTurno();
      const { body } = await vender().expect(201);

      const resumen = await http()
        .get(`/api/shifts/${turno}/summary`)
        .set('Cookie', vendedor)
        .expect(200);

      expect(resumen.body.byMethod.cash).toBe(Number(body.order.total));
    });

    it('exige orders:create y pos:create: con uno solo responde 403', async () => {
      const soloOrdenes = await sessionAs(app, 'admin@loklflow.com', ['orders:create']);
      await http()
        .post('/api/orders/quick-sale')
        .set('Cookie', soloOrdenes)
        .send({
          id: randomUUID(),
          items: [{ productId: product.id, quantity: 1 }],
          payment: { method: 'cash' },
        })
        .expect(403);
    });

    it('un producto que no existe responde 400 y no deja la cuenta a medias', async () => {
      await abrirTurno();
      const id = randomUUID();
      await vender({ id, items: [{ productId: randomUUID(), quantity: 1 }] }).expect(400);

      const filas = await ds.query(`SELECT id FROM orders WHERE id = $1`, [id]);
      expect(filas).toHaveLength(0);
    });

    /**
     * La ruta es literal y vive en `PaymentsModule`, pero cuelga de `/orders`. Hoy no choca porque
     * `OrdersController` no declara ningún `@Post(':id')`; el día que alguien lo añada ganaría esa
     * ruta —`OrdersModule` se importa antes en `AppModule`— y esto dejaría de responder.
     */
    it('la ruta /orders/quick-sale no la captura ninguna ruta de OrdersController', async () => {
      await abrirTurno();
      // Si `:id` la capturase, `ParseUuidPipe` respondería 400 por «quick-sale» y no un 201.
      await vender().expect(201);
    });
  });
});
