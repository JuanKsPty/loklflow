import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, seededUser, sessionAs } from '../../test/fixtures';
import { ProductStockService } from './product-stock.service';
import { StockService } from './stock.service';

/**
 * Existencias por producto.
 *
 * El producto *es* la unidad que se cuenta —una botella, una bolsa—, y por debajo eso es un
 * ingrediente espejo con `product_id`. Lo que esta suite protege es que esa indirección no se
 * escape: que el catálogo de insumos no se llene de espejos, que nadie descuente dos veces por
 * tener espejo y receta, y que fijar el stock a mano no se trague una venta que se estaba
 * cerrando en ese mismo instante.
 */
describe('Existencias por producto', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  let product: { id: string; price: number };
  let adminId: string;
  /** Sesión con permiso de escritura en el catálogo, para los productos que crea esta suite. */
  let escritor: string;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'inventory:create',
      'inventory:read',
      'inventory:update',
      'inventory:delete',
      'menu:read',
      'menu:delete',
    ]);
    product = await firstProduct(app);
    adminId = (await seededUser(app, 'admin@loklflow.com')).id;
    escritor = await sessionAs(app, 'admin@loklflow.com', ['menu:create']);
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    // Los productos son catálogo del seed, así que `resetOperationalData` no los toca: los que
    // crea esta suite se limpian a mano, y sus espejos antes que ellos por la clave ajena.
    // Va **antes** de cerrar la aplicación, que es lo que cierra la conexión.
    if (creados.length > 0) {
      await ds.query(
        `DELETE FROM stock_movements WHERE ingredient_id IN
           (SELECT id FROM ingredients WHERE product_id = ANY($1::uuid[]))`,
        [creados],
      );
      await ds.query(`DELETE FROM ingredients WHERE product_id = ANY($1::uuid[])`, [creados]);
      await ds.query(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [creados]);
    }
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  /** Productos que crea esta suite. El seed no los conoce, así que se limpian a mano. */
  const creados: string[] = [];

  interface Row {
    productId: string;
    name: string;
    price: number;
    tracked: boolean;
    currentStock: number | null;
    minimumStock: number | null;
    lowStock: boolean;
    hasRecipe: boolean;
    ingredientId: string | null;
  }

  async function list(query = ''): Promise<Row[]> {
    const res = await http()
      .get(`/api/inventory/products${query}`)
      .set('Cookie', admin)
      .expect(200);
    return res.body as Row[];
  }

  const rowOf = (rows: Row[], id: string) => rows.find((r) => r.productId === id)!;

  // Sin `async`: devuelve la cadena de supertest para poder encadenar `.expect(...)`.
  function setStock(newStock: number, reasonCode = 'count', note?: string) {
    return http()
      .put(`/api/inventory/products/${product.id}/stock`)
      .set('Cookie', admin)
      .send({ newStock, reasonCode, ...(note ? { note } : {}) });
  }

  interface Movimiento {
    type: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string | null;
  }

  async function movements(ingredientId: string): Promise<Movimiento[]> {
    const rows = await ds.query(
      `SELECT type, quantity, previous_stock, new_stock, reason
         FROM stock_movements WHERE ingredient_id = $1 ORDER BY created_at, id`,
      [ingredientId],
    );
    return rows.map((r: Record<string, string>): Movimiento => ({
      type: r.type,
      quantity: Number(r.quantity),
      previousStock: Number(r.previous_stock),
      newStock: Number(r.new_stock),
      reason: r.reason,
    }));
  }

  describe('fijar el stock', () => {
    it('un producto sin seguimiento sale en el listado con stock nulo', async () => {
      const row = rowOf(await list(), product.id);
      expect(row.tracked).toBe(false);
      // `null` y no `0`: «no lo cuento» y «tengo cero» son cosas distintas.
      expect(row.currentStock).toBeNull();
    });

    it('fijarlo a 12 crea el espejo y deja un ajuste de +12 en el libro mayor', async () => {
      const res = await setStock(12).expect(200);
      const row = res.body as Row;

      expect(row.tracked).toBe(true);
      expect(row.currentStock).toBe(12);
      expect(await movements(row.ingredientId!)).toEqual([
        { type: 'adjustment', quantity: 12, previousStock: 0, newStock: 12, reason: 'Recuento' },
      ]);
    });

    it('volver a fijarlo a 5 escribe la diferencia, no el número', async () => {
      await setStock(12).expect(200);
      const res = await setStock(5).expect(200);
      const row = res.body as Row;

      expect(row.currentStock).toBe(5);
      // −7, que es lo que hace que el historial explique cómo se llegó al número de hoy.
      expect((await movements(row.ingredientId!)).map((m) => m.quantity)).toEqual([12, -7]);
    });

    it('fijarlo al mismo número deja un movimiento de cero: un recuento que confirma es un hecho', async () => {
      const primero = (await setStock(8).expect(200)).body as Row;
      await setStock(8).expect(200);

      const movs = await movements(primero.ingredientId!);
      expect(movs).toHaveLength(2);
      expect(movs[1]).toMatchObject({ quantity: 0, previousStock: 8, newStock: 8 });
    });

    it('el motivo se guarda con su etiqueta, y la nota del operario detrás', async () => {
      const row = (await setStock(3, 'waste', 'se cayó una caja').expect(200)).body as Row;
      const movs = await movements(row.ingredientId!);
      expect(movs[0].reason).toBe('Merma · se cayó una caja');
    });

    it('acepta un stock negativo: si el operario debe unidades, tiene que poder decirlo', async () => {
      const row = (await setStock(-2).expect(200)).body as Row;
      expect(row.currentStock).toBe(-2);
    });

    it('un motivo que no es de los tres se rechaza', async () => {
      await setStock(1, 'porque sí').expect(400);
    });
  });

  describe('separación del catálogo de insumos', () => {
    it('el espejo no aparece entre los ingredientes', async () => {
      const row = (await setStock(4).expect(200)).body as Row;

      const insumos = await http().get('/api/inventory/ingredients').set('Cookie', admin).expect(200);
      expect((insumos.body as { id: string }[]).some((i) => i.id === row.ingredientId)).toBe(false);
    });

    it('ni entre los insumos bajo mínimo', async () => {
      const row = (await setStock(0).expect(200)).body as Row;
      await http()
        .patch(`/api/inventory/ingredients/${row.ingredientId}`)
        .set('Cookie', admin)
        .send({ minimumStock: 5 })
        .expect(200);

      const bajos = await http()
        .get('/api/inventory/ingredients?lowStock=true')
        .set('Cookie', admin)
        .expect(200);
      expect((bajos.body as { id: string }[]).some((i) => i.id === row.ingredientId)).toBe(false);
    });

    it('no se le puede cambiar el nombre ni la unidad desde la edición de ingredientes', async () => {
      const row = (await setStock(1).expect(200)).body as Row;

      await http()
        .patch(`/api/inventory/ingredients/${row.ingredientId}`)
        .set('Cookie', admin)
        .send({ name: 'Otro nombre' })
        .expect(400);
      await http()
        .patch(`/api/inventory/ingredients/${row.ingredientId}`)
        .set('Cookie', admin)
        .send({ unit: 'kg' })
        .expect(400);
    });

    it('dos productos que se llaman igual pueden tener existencias los dos', async () => {
      // `products.name` no es único, así que sus espejos tampoco pueden serlo. Es justo lo que
      // el índice parcial `WHERE product_id IS NULL` permite.
      const a = await crearProducto('Homónimo');
      const b = await crearProducto('Homónimo');

      await ponerStock(a, 3);
      await ponerStock(b, 7);

      const rows = await list();
      expect(rowOf(rows, a).currentStock).toBe(3);
      expect(rowOf(rows, b).currentStock).toBe(7);
    });

    it('un insumo del catálogo sigue sin poder repetir nombre', async () => {
      const nombre = `Insumo único ${Date.now()}`;
      await http()
        .post('/api/inventory/ingredients')
        .set('Cookie', admin)
        .send({ name: nombre, unit: 'kg' })
        .expect(201);
      await http()
        .post('/api/inventory/ingredients')
        .set('Cookie', admin)
        .send({ name: nombre, unit: 'kg' })
        .expect(500); // violación de unicidad: el índice sigue haciendo su trabajo
    });
  });

  describe('espejo y receta se excluyen', () => {
    it('un producto con receta no puede llevar existencias propias', async () => {
      const insumo = await crearInsumo();
      await http()
        .put(`/api/inventory/recipes/${product.id}`)
        .set('Cookie', admin)
        .send({ lines: [{ ingredientId: insumo, quantity: 1 }] })
        .expect(200);

      const res = await setStock(5);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/receta/i);
    });

    it('y un producto con existencias propias no puede recibir una receta', async () => {
      await setStock(5).expect(200);
      const insumo = await crearInsumo();

      const res = await http()
        .put(`/api/inventory/recipes/${product.id}`)
        .set('Cookie', admin)
        .send({ lines: [{ ingredientId: insumo, quantity: 1 }] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/existencias propias/i);
    });

    it('un espejo no puede ser ingrediente de la receta de otro producto', async () => {
      const row = (await setStock(5).expect(200)).body as Row;
      const otro = await crearProducto('Con receta');

      const res = await http()
        .put(`/api/inventory/recipes/${otro}`)
        .set('Cookie', admin)
        .send({ lines: [{ ingredientId: row.ingredientId, quantity: 1 }] });
      expect(res.status).toBe(400);
    });
  });

  describe('listado y filtros', () => {
    it('`?lowStock=true` devuelve los que están en el mínimo o por debajo', async () => {
      const row = (await setStock(2).expect(200)).body as Row;
      await http()
        .patch(`/api/inventory/ingredients/${row.ingredientId}`)
        .set('Cookie', admin)
        .send({ minimumStock: 5 })
        .expect(200);

      const bajos = await list('?lowStock=true');
      expect(bajos.some((r) => r.productId === product.id)).toBe(true);
    });

    it('y también los que están en negativo aunque no tengan mínimo', async () => {
      // Con la regla ingenua `current <= minimum`, un producto en −5 con mínimo 0 no aparecería
      // nunca: el cero significa «no me avises», no «siempre bajo».
      await setStock(-5).expect(200);
      const bajos = await list('?lowStock=true');
      expect(bajos.some((r) => r.productId === product.id)).toBe(true);
    });

    it('`?tracked=false` devuelve justo los que aún no llevan stock', async () => {
      await setStock(3).expect(200);
      const sin = await list('?tracked=false');
      expect(sin.some((r) => r.productId === product.id)).toBe(false);
      expect(sin.every((r) => r.tracked === false)).toBe(true);
    });

    it('trae precio y categoría: la pantalla se pinta con una sola petición', async () => {
      const row = rowOf(await list(), product.id);
      expect(typeof row.price).toBe('number');
      expect(row.price).toBeGreaterThan(0);
      expect(row).toHaveProperty('categoryName');
    });

    it('los importes llegan como números y no como las cadenas que devuelve Postgres', async () => {
      // `getRawMany()` no pasa por los transformadores: sin el mapeo, el móvil concatena
      // `"12" + 1` y muestra `121`.
      const row = (await setStock(12).expect(200)).body as Row;
      expect(typeof row.currentStock).toBe('number');
      expect(typeof row.minimumStock).toBe('number');
      expect(typeof row.price).toBe('number');
    });
  });

  describe('dejar de llevar existencias', () => {
    it('conserva el historial y deja de descontar', async () => {
      const row = (await setStock(10).expect(200)).body as Row;

      await http()
        .delete(`/api/inventory/products/${product.id}/stock`)
        .set('Cookie', admin)
        .expect(200);

      // El libro mayor sigue ahí: lo que pasó, pasó.
      expect(await movements(row.ingredientId!)).toHaveLength(1);
      expect(rowOf(await list(), product.id).tracked).toBe(false);
    });

    it('y volver a activarlo retoma el mismo ingrediente, no crea otro', async () => {
      const primero = (await setStock(10).expect(200)).body as Row;
      await http()
        .delete(`/api/inventory/products/${product.id}/stock`)
        .set('Cookie', admin)
        .expect(200);

      const segundo = (await setStock(4).expect(200)).body as Row;
      expect(segundo.ingredientId).toBe(primero.ingredientId);
      // Y el historial explica el salto de 10 a 4, en vez de empezar de la nada.
      expect((await movements(primero.ingredientId!)).map((m) => m.quantity)).toEqual([10, -6]);
    });

    it('exige inventory:delete, no basta con poder editar', async () => {
      await setStock(1).expect(200);
      const soloEdicion = await sessionAs(app, 'admin@loklflow.com', [
        'inventory:read',
        'inventory:update',
      ]);
      await http()
        .delete(`/api/inventory/products/${product.id}/stock`)
        .set('Cookie', soloEdicion)
        .expect(403);
    });
  });

  describe('borrado del producto', () => {
    it('un producto con existencias responde 400, no un 500 de clave ajena', async () => {
      const otro = await crearProducto('Se intenta borrar');
      await ponerStock(otro, 2);

      const res = await http().delete(`/api/menu/products/${otro}`).set('Cookie', admin);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/existencias/i);
    });
  });

  describe('concurrencia', () => {
    it('dos «ahora tengo 12» a la vez dejan el stock en 12 y dos movimientos que se explican', async () => {
      await setStock(0).expect(200);
      const row = rowOf(await list(), product.id);

      const stock = app.get(StockService);
      await Promise.all([
        stock.setLevel(
          { ingredientId: row.ingredientId!, toStock: 12, reasonCode: 'count' },
          adminId,
        ),
        stock.setLevel(
          { ingredientId: row.ingredientId!, toStock: 12, reasonCode: 'count' },
          adminId,
        ),
      ]);

      expect(rowOf(await list(), product.id).currentStock).toBe(12);
      // El segundo ve el stock que dejó el primero: sin el cerrojo, los dos partirían de cero y
      // el historial diría que se llegó a 12 desde un número que nunca existió.
      const movs = await movements(row.ingredientId!);
      expect(movs[movs.length - 1].previousStock).toBe(12);
    });

    /**
     * El caso que justifica calcular el delta **dentro** de la transacción.
     *
     * No se afirma un resultado concreto: quién llega primero es justo lo que una carrera no
     * garantiza, y las dos ordenaciones son legítimas (fijar a 12 después de vender **es** 12).
     * Lo que sí tiene que cumplirse siempre es que el libro mayor sea una cadena continua —el
     * `previous_stock` de cada movimiento es el `new_stock` del anterior— y que el stock actual
     * sea el último eslabón.
     *
     * Con el delta calculado fuera del cerrojo esa cadena se rompe: el ajuste se escribe contra
     * un número que ya no era de nadie y **se traga la venta** sin dejar señal.
     */
    it('fijar el stock mientras entra otro movimiento deja un libro mayor que cuadra', async () => {
      await setStock(10).expect(200);
      const row = rowOf(await list(), product.id);

      const stock = app.get(StockService);
      await Promise.all([
        stock.setLevel(
          { ingredientId: row.ingredientId!, toStock: 12, reasonCode: 'count' },
          adminId,
        ),
        stock.record(
          { ingredientId: row.ingredientId!, type: 'waste', quantity: 1, reason: 'rotura' },
          adminId,
        ),
      ]);

      const movs = await movements(row.ingredientId!);
      // Los dos movimientos están: ninguno se perdió pisando al otro.
      expect(movs).toHaveLength(3);
      // Y la cadena es continua. Es lo que se rompe si el delta se calcula fuera del cerrojo:
      // el ajuste se escribiría contra un número que ya no era de nadie.
      for (let i = 1; i < movs.length; i++) {
        expect(movs[i].previousStock).toBe(movs[i - 1].newStock);
      }
      expect(rowOf(await list(), product.id).currentStock).toBe(movs[movs.length - 1].newStock);
    });

    it('dos primeras activaciones a la vez crean un solo ingrediente espejo', async () => {
      const servicio = app.get(ProductStockService);
      await Promise.all([
        servicio.setStock(product.id, { newStock: 5, reasonCode: 'count' }, adminId),
        servicio.setStock(product.id, { newStock: 5, reasonCode: 'count' }, adminId),
      ]);

      const espejos = await ds.query(
        `SELECT id FROM ingredients WHERE product_id = $1`,
        [product.id],
      );
      expect(espejos).toHaveLength(1);
    });
  });

  // ── ayudantes ───────────────────────────────────────────────────────────────

  async function crearProducto(nombre: string): Promise<string> {
    const res = await http()
      .post('/api/menu/products')
      .set('Cookie', escritor)
      .send({ name: `${nombre} ${creados.length}`, price: 50 })
      .expect(201);
    creados.push(res.body.id);
    return res.body.id as string;
  }

  async function crearInsumo(): Promise<string> {
    const res = await http()
      .post('/api/inventory/ingredients')
      .set('Cookie', admin)
      .send({ name: `Insumo ${Math.random()}`, unit: 'kg', initialStock: 10 })
      .expect(201);
    return res.body.id as string;
  }

  async function ponerStock(productId: string, newStock: number) {
    await http()
      .put(`/api/inventory/products/${productId}/stock`)
      .set('Cookie', admin)
      .send({ newStock, reasonCode: 'count' })
      .expect(200);
  }
});
