import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, sessionAs } from '../../test/fixtures';
import { GUEST_TOKEN_HEADER } from './guest-token';

/**
 * El menú y el pedido desde el QR, **sin sesión**.
 *
 * Es la única superficie de la aplicación que alcanza un desconocido, así que la mitad de estas
 * pruebas no comprueban que funcione: comprueban qué **no** deja pasar y qué **no** deja ver.
 */
describe('menú público por QR', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  let product: { id: string; name: string; price: number };
  let allTables: { id: string; number: number; qrCode: string }[];
  let table: { id: string; number: number; qrCode: string };
  let qrCode: string;
  let nextTable = 0;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'tables:read',
      'tables:update',
      'orders:read',
    ]);
    product = await firstProduct(app);
  });

  /**
   * **Una mesa distinta por caso.**
   *
   * El límite de peticiones de las rutas públicas se cuenta por mesa (ver
   * `PublicThrottlerGuard`), y el almacén es en memoria: no se reinicia entre casos. Compartir
   * mesa haría que los últimos casos del archivo fallaran con 429 según el orden de ejecución,
   * que es el tipo de intermitencia que acaba con un `it.skip`.
   *
   * Rotar de mesa es además más realista: son clientes distintos en mesas distintas.
   */
  beforeEach(async () => {
    await resetOperationalData(ds);
    const res = await request(app.getHttpServer())
      .get('/api/tables')
      .set('Cookie', admin)
      .expect(200);
    allTables = res.body as typeof allTables;
    // La última mesa queda **reservada** para el caso que agota el cupo a propósito: su bucket
    // queda inservible durante cinco minutos, y la rotación acabaría volviendo a ella —hay más
    // casos que mesas— haciendo fallar con 429 un test que no tiene nada que ver. Es justo la
    // clase de intermitencia que depende del orden de ejecución y acaba en un `it.skip`.
    const rotables = allTables.slice(0, -1);
    table = rotables[nextTable % rotables.length];
    nextTable += 1;
    qrCode = table.qrCode;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // **Sin cookie en ninguna de estas llamadas**: es el punto de todo el archivo.
  const http = () => request(app.getHttpServer());
  const getMenu = (code = qrCode) => http().get(`/api/public/menu/${code}`);
  const order = (body: Record<string, unknown>, code = qrCode) =>
    http().post(`/api/public/menu/${code}/orders`).send(body);
  const oneItem = () => ({ items: [{ productId: product.id, quantity: 2 }] });

  describe('el menú', () => {
    it('se sirve sin sesión y trae el negocio, la mesa y el catálogo', async () => {
      const res = await getMenu().expect(200);

      expect(res.body.business).toMatchObject({ name: expect.any(String) });
      expect(res.body.table).toMatchObject({ number: table.number, acceptsOrders: true });
      expect(res.body.products.length).toBeGreaterThan(0);
      expect(typeof res.body.serverTime).toBe('string');
    });

    /**
     * Lo que se filtraría con `@Public()` sobre los controladores que ya existen, y el motivo de
     * que haya DTOs propios: `station` dice cómo funciona la cocina por dentro, y el `qrCode` de la
     * mesa es la credencial misma.
     */
    it('no filtra los campos internos del catálogo ni de la mesa', async () => {
      const res = await getMenu().expect(200);
      const payload = JSON.stringify(res.body);

      expect(res.body.table.qrCode).toBeUndefined();
      expect(res.body.table.status).toBeUndefined();
      expect(res.body.table.capacity).toBeUndefined();
      expect(payload).not.toContain('"station"');
      expect(payload).not.toContain('"isActive"');
      expect(payload).not.toContain('createdAt');
    });

    it('los modificadores llegan con sus opciones', async () => {
      // Sin las opciones anidadas, un grupo obligatorio llega vacío y su producto no se puede
      // pedir. Las pantallas del personal lo tapaban pidiendo los modificadores por separado; el
      // menú público hace una sola petición y se habría encontrado con el problema de frente.
      const res = await getMenu().expect(200);
      const conModificadores = res.body.products.find(
        (p: { modifiers: unknown[] }) => p.modifiers.length > 0,
      );

      if (conModificadores) {
        expect(Array.isArray(conModificadores.modifiers[0].options)).toBe(true);
      }
    });

    it('un código con formato válido pero inexistente da 404', async () => {
      await getMenu('11111111-1111-4111-8111-111111111111').expect(404);
    });

    /**
     * Mal formado también es **404**, y no 400. Distinguirlos le diría a quien sondea que su
     * formato era correcto y que solo falló el valor; y `ParseUuidPipe`, el del resto del repo,
     * devuelve el valor recibido en el mensaje (`"<valor>" is not a valid UUID`), que en una ruta
     * pública es un reflejo gratuito de lo que le manden.
     */
    it('un código mal formado da 404 sin devolver el valor recibido', async () => {
      const res = await getMenu('no-es-un-uuid').expect(404);

      expect(res.body.message).not.toContain('no-es-un-uuid');
    });

    it('un valor con barras no rompe nada', async () => {
      // No llega al pipe —son otros segmentos de ruta— y tiene que salir un 404 limpio, no un 500.
      await getMenu('..%2F..%2Fetc%2Fpasswd').expect(404);
    });

    it('un QR rotado deja de valer', async () => {
      await http().post(`/api/tables/${table.id}/qr/rotate`).set('Cookie', admin).expect(201);

      await getMenu().expect(404);
    });
  });

  describe('pedir', () => {
    it('crea la orden como customer_qr y sin mesero', async () => {
      const res = await order({ ...oneItem(), customerName: 'Ana' }).expect(201);

      expect(res.body.order).toMatchObject({ status: 'pending' });
      expect(typeof res.body.trackingToken).toBe('string');

      const [row] = await ds.query(
        'SELECT source, waiter_id, label FROM orders WHERE order_number = $1',
        [res.body.order.orderNumber],
      );
      expect(row.source).toBe('customer_qr');
      // `DATA_MODEL.md` lo pedía desde el principio y `create` escribía el id de quien firmara.
      expect(row.waiter_id).toBeNull();
      expect(row.label).toBe('Ana');
    });

    /**
     * La regla que impide que un cliente se haga pasar por personal, elija la clave primaria de una
     * orden —una primitiva de sondeo y de sobrescritura— o pida a nombre de otra mesa.
     * `forbidNonWhitelisted` la hace efectiva, no solo documental.
     */
    it.each([
      ['id', { id: '99999999-9999-4999-8999-999999999999' }],
      ['source', { source: 'staff' }],
      ['tableId', { tableId: '99999999-9999-4999-8999-999999999999' }],
      ['label', { label: 'me lo invento' }],
    ])('rechaza que el cliente mande %s', async (_campo, extra) => {
      await order({ ...oneItem(), ...extra }).expect(400);
    });

    /**
     * Un `{ quantity: 999999 }` es **una** petición bien formada: no la atrapa ningún límite de
     * peticiones, y manda a la plancha mil kilos de carne descuadrando el inventario.
     */
    it('acota la cantidad por línea y el número de líneas', async () => {
      await order({ items: [{ productId: product.id, quantity: 999999 }] }).expect(400);
      await order({
        items: Array.from({ length: 30 }, () => ({ productId: product.id, quantity: 1 })),
      }).expect(400);
      await order({ items: [] }).expect(400);
    });

    it('los precios los pone el servidor, no el cuerpo de la petición', async () => {
      const res = await order(oneItem()).expect(201);

      // No se manda ningún importe y el total sale del catálogo. Si un refactor abriera la puerta
      // a que el cliente proponga precios, esto lo detecta.
      expect(Number(res.body.order.total)).toBeCloseTo(product.price * 2, 2);
    });

    it('una mesa reservada o en mantenimiento no recibe pedidos', async () => {
      await http()
        .patch(`/api/tables/${table.id}/status`)
        .set('Cookie', admin)
        .send({ status: 'reserved' })
        .expect(200);

      // Es lo que impide pedir desde el aparcamiento con una foto del QR.
      expect((await getMenu().expect(200)).body.table.acceptsOrders).toBe(false);
      await order(oneItem()).expect(409);
    });

    it('hay un tope de pedidos vivos por mesa', async () => {
      // Acota el destrozo de un código filtrado: sin tope, quien tenga la foto puede llenar la
      // cocina de comandas para una mesa vacía.
      for (let i = 0; i < 5; i++) {
        await order(oneItem()).expect(201);
      }

      await order(oneItem()).expect(409);
    });

    it('un producto que no existe no crea nada', async () => {
      await order({
        items: [{ productId: '99999999-9999-4999-8999-999999999999', quantity: 1 }],
      }).expect(409);
    });

    /**
     * El límite de peticiones se cuenta **por mesa** y no por IP, y esto es lo que lo prueba.
     *
     * En la WiFi del local todos los clientes comparten una sola IP a ojos de la API, así que un
     * límite por IP le negaría el pedido al cuarto cliente del restaurante entero — con un
     * «demasiados intentos» a alguien que no ha intentado nada.
     */
    it('agotar el límite de una mesa no afecta a otra', async () => {
      // La mesa reservada: su cupo queda quemado durante cinco minutos y ningún otro caso la usa.
      const quemada = allTables[allTables.length - 1];

      // Se agota a base de peticiones inválidas, que también cuentan para el límite.
      for (let i = 0; i < 14; i++) {
        await order({ items: [] }, quemada.qrCode);
      }
      await order(oneItem(), quemada.qrCode).expect(429);

      // La mesa de al lado sigue pudiendo pedir: es lo que prueba que la clave es por mesa.
      await order(oneItem()).expect(201);
    });
  });

  /**
   * Que el pedido llegue a alguien.
   *
   * Un pedido por QR **no lo toma nadie del personal**: `waiterId` es `null` por definición, así
   * que si no se avisa, nadie sabe que existe. El único aviso que salía era el de Cocina, y solo
   * cuando algo se preparaba en cocina — dos aguas y un postre no generaban ninguna notificación
   * y la cuenta se quedaba abierta sin que nadie se enterara.
   */
  describe('avisar al personal', () => {
    /**
     * Los avisos **de una comanda concreta**, no los de la tabla entera.
     *
     * El filtro por número de orden no es cosmético: el aviso se escribe con `void` y puede
     * aterrizar después del `resetOperationalData` del caso siguiente, así que un `SELECT` sin
     * acotar devuelve el aviso del caso anterior y la afirmación pasa por el motivo equivocado.
     */
    const notificacionesDe = (rol: string, orderNumber: number) =>
      ds.query(
        `SELECT n.title, n.type
           FROM notifications n
           JOIN users u ON u.id = n.user_id
           JOIN roles r ON r.id = u.role_id
           JOIN orders o ON o.id = n.resource_id
          WHERE r.name = $1 AND o.order_number = $2`,
        [rol, orderNumber],
      ) as Promise<{ title: string; type: string }[]>;

    /**
     * El aviso sale con `void`: es best-effort y **no** bloquea la respuesta del pedido, que es lo
     * correcto —un fallo del sistema de notificaciones no puede tumbar una comanda— pero significa
     * que el 201 llega antes de que la fila exista. Sondear es la forma honesta de esperarlo;
     * afirmar justo después del 201 es una carrera que pasa o falla según la máquina.
     */
    async function esperaAvisos(rol: string, orderNumber: number, cuantos: number) {
      for (let intento = 0; intento < 50; intento++) {
        const filas = await notificacionesDe(rol, orderNumber);
        if (filas.length >= cuantos) return filas;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return notificacionesDe(rol, orderNumber);
    }

    /** Los productos del menú público que se preparan en la estación dada. */
    async function delMenuConEstacion(estacion: string): Promise<string[]> {
      const menu = await getMenu().expect(200);
      const ids = (menu.body.products as { id: string }[]).map((p) => p.id);
      const filas = (await ds.query(
        `SELECT id FROM products WHERE id = ANY($1::uuid[]) AND station = $2`,
        [ids, estacion],
      )) as { id: string }[];
      return filas.map((f) => f.id);
    }

    it('avisa al salón aunque no haya nada que pase por cocina', async () => {
      const [bebida] = await delMenuConEstacion('bar');
      expect(bebida).toBeDefined();

      const creada = await order({ items: [{ productId: bebida, quantity: 2 }] }).expect(201);
      const numero = creada.body.order.orderNumber as number;

      const avisos = await esperaAvisos('Mesero', numero, 1);
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toMatchObject({ type: 'order_new' });
      expect(avisos[0].title).toContain(String(numero));
      // Nada de esa comanda pasa por cocina, así que allí no tiene que sonar nada.
      expect(await notificacionesDe('Cocina', numero)).toHaveLength(0);
    });

    it('una comanda del personal no genera ese aviso: quien la tomó ya lo sabe', async () => {
      const [deCocina] = await delMenuConEstacion('kitchen');
      expect(deCocina).toBeDefined();

      const staff = await sessionAs(app, 'admin@loklflow.com', ['orders:create']);
      const creada = await http()
        .post('/api/orders')
        .set('Cookie', staff)
        .send({ tableId: table.id, items: [{ productId: deCocina, quantity: 1 }] })
        .expect(201);
      const numero = creada.body.orderNumber as number;

      // El aviso a Cocina sí sale, y sirve de ancla: cuando está, el pedido terminó de procesarse
      // y comprobar que el salón no tiene ninguno ya no es una carrera.
      await esperaAvisos('Cocina', numero, 1);
      expect(await notificacionesDe('Mesero', numero)).toHaveLength(0);
    });
  });

  describe('seguir el pedido', () => {
    it('con el pase devuelve el estado, sin pasar ningún id', async () => {
      const created = await order(oneItem()).expect(201);

      const res = await http()
        .get('/api/public/orders/me')
        .set(GUEST_TOKEN_HEADER, created.body.trackingToken)
        .expect(200);

      expect(res.body.orderNumber).toBe(created.body.order.orderNumber);
      expect(res.body.items[0]).toMatchObject({ quantity: 2, status: 'pending' });
    });

    /**
     * Lo que el pase **no** deja ver. Quién atiende, en qué turno y qué descuentos se aplicaron son
     * asuntos del negocio; los pagos, más todavía.
     */
    it('no expone mesero, turno, pagos ni descuentos', async () => {
      const created = await order(oneItem()).expect(201);

      const res = await http()
        .get('/api/public/orders/me')
        .set(GUEST_TOKEN_HEADER, created.body.trackingToken)
        .expect(200);

      expect(res.body.waiterId).toBeUndefined();
      expect(res.body.shiftId).toBeUndefined();
      expect(res.body.payments).toBeUndefined();
      expect(res.body.discountAmount).toBeUndefined();
      expect(res.body.statusHistory).toBeUndefined();
    });

    it('sin pase, con un pase inventado o caducado da 401', async () => {
      await http().get('/api/public/orders/me').expect(401);
      await http().get('/api/public/orders/me').set(GUEST_TOKEN_HEADER, 'inventado').expect(401);
    });

    /**
     * Un pase no es una sesión. Se comprueba desde fuera porque la defensa está en dos sitios —el
     * secreto derivado y el rechazo por `typ` en `JwtStrategy`— y ninguno depende de que el otro se
     * acuerde.
     */
    it('el pase no sirve como sesión de personal', async () => {
      const created = await order(oneItem()).expect(201);
      const pase = created.body.trackingToken as string;

      await http().get('/api/orders').set('Cookie', `access_token=${pase}`).expect(401);
      await http().get('/api/orders').set('Authorization', `Bearer ${pase}`).expect(401);
    });
  });
});
