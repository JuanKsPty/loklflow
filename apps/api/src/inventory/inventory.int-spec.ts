import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { resetOperationalData } from '../../test/database';
import { firstProduct, firstTable, sessionAs } from '../../test/fixtures';
import { StockService } from './stock.service';

/**
 * Inventario contra la base real.
 *
 * Lo que de verdad justifica esta suite es el **doble descuento**: el consumo se registra al
 * cerrar la cuenta, y a un cierre se llega por dos caminos y se puede llegar dos veces —dos
 * pagos concurrentes que la saldan hoy, y una operación reenviada desde la cola sin conexión
 * mañana—. Sin el índice único parcial el stock se resta otra vez y el inventario deja de
 * valer para nada, en silencio.
 */
describe('Inventario', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  let waiter: string;
  let cashier: string;
  let product: { id: string; price: number };
  let table: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'inventory:create',
      'inventory:read',
      'inventory:update',
      'inventory:delete',
    ]);
    waiter = await sessionAs(app, 'mesero@loklflow.com', ['orders:create', 'orders:read']);
    cashier = await sessionAs(app, 'cajero@loklflow.com', ['pos:create', 'pos:read', 'orders:read']);
    product = await firstProduct(app);
    table = await firstTable(app);
  });

  beforeEach(async () => {
    await resetOperationalData(ds);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  async function createIngredient(overrides: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/inventory/ingredients')
      .set('Cookie', admin)
      .send({ name: `Ingrediente ${Math.random()}`, unit: 'kg', initialStock: 100, ...overrides })
      .expect(201);
    return res.body as { id: string; currentStock: number; costPerUnit: number };
  }

  async function setRecipe(ingredientId: string, quantity: number) {
    await http()
      .put(`/api/inventory/recipes/${product.id}`)
      .set('Cookie', admin)
      .send({ lines: [{ ingredientId, quantity }] })
      .expect(200);
  }

  /**
   * Abre el turno del cajero si no lo está ya.
   *
   * El 400 no se ignora por comodidad: es `idx_shifts_one_open_per_user` haciendo su trabajo.
   * Un test que venda dos veces seguidas no puede abrir dos turnos, y pretenderlo sería
   * probar contra un comportamiento que el sistema prohíbe a propósito.
   */
  async function ensureShift() {
    const res = await http()
      .post('/api/shifts/open')
      .set('Cookie', cashier)
      .send({ openingCash: 100 });
    if (res.status !== 201 && res.status !== 400) {
      throw new Error(`No se pudo abrir el turno: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }

  /** Cuenta de `quantity` unidades del producto, cobrada entera: eso la cierra. */
  async function sellAndClose(quantity: number) {
    await ensureShift();

    const order = await http()
      .post('/api/orders')
      .set('Cookie', waiter)
      .send({ tableId: table.id, items: [{ productId: product.id, quantity }] })
      .expect(201);

    await http()
      .post(`/api/orders/${order.body.id}/payments`)
      .set('Cookie', cashier)
      .send({ method: 'cash', amount: order.body.total })
      .expect(201);

    return order.body as { id: string; status: string };
  }

  async function stockOf(id: string): Promise<number> {
    const rows = await ds.query(`SELECT current_stock FROM ingredients WHERE id = $1`, [id]);
    return Number(rows[0].current_stock);
  }

  async function movementsOf(id: string): Promise<{ type: string; quantity: number }[]> {
    const rows = await ds.query(
      `SELECT type, quantity FROM stock_movements WHERE ingredient_id = $1 ORDER BY created_at`,
      [id],
    );
    return rows.map((r: { type: string; quantity: string }) => ({
      type: r.type,
      quantity: Number(r.quantity),
    }));
  }

  describe('descuento al cerrar la cuenta', () => {
    it('resta lo que dice la receta, multiplicado por las unidades vendidas', async () => {
      const ingredient = await createIngredient({ initialStock: 100 });
      await setRecipe(ingredient.id, 0.25);

      await sellAndClose(3);

      expect(await stockOf(ingredient.id)).toBe(99.25);
      expect(await movementsOf(ingredient.id)).toEqual([
        { type: 'adjustment', quantity: 100 },
        { type: 'consumption', quantity: -0.75 },
      ]);
    });

    /**
     * El caso que da sentido al índice único parcial. Se reenvía el mismo consumo, que es lo
     * que hará la cola sin conexión de la Fase 4 y lo que ya puede pasar hoy con dos pagos
     * concurrentes que saldan la misma cuenta.
     */
    it('un cierre reenviado NO vuelve a descontar', async () => {
      const ingredient = await createIngredient({ initialStock: 100 });
      await setRecipe(ingredient.id, 2);

      const order = await sellAndClose(1);
      expect(await stockOf(ingredient.id)).toBe(98);

      await app
        .get(StockService)
        .consumeForOrder(order.id, [{ productId: product.id, quantity: 1 }], 'ignored');

      expect(await stockOf(ingredient.id)).toBe(98);
      expect(await movementsOf(ingredient.id)).toHaveLength(2);
    });

    it('ni aunque dos reenvíos lleguen a la vez', async () => {
      const ingredient = await createIngredient({ initialStock: 50 });
      await setRecipe(ingredient.id, 1);

      const order = await sellAndClose(1);
      const stock = app.get(StockService);
      const items = [{ productId: product.id, quantity: 1 }];

      // La comprobación previa del servicio no basta aquí: las dos llamadas la pasan antes
      // de que ninguna escriba. Quien decide es el índice de la base.
      await Promise.all([
        stock.consumeForOrder(order.id, items, 'a'),
        stock.consumeForOrder(order.id, items, 'b'),
      ]);

      expect(await stockOf(ingredient.id)).toBe(49);
      expect(
        (await movementsOf(ingredient.id)).filter((m) => m.type === 'consumption'),
      ).toHaveLength(1);
    });

    it('un producto sin receta no descuenta nada y no rompe el cobro', async () => {
      const ingredient = await createIngredient({ initialStock: 10 });
      // Sin receta para el producto que se vende.

      const order = await sellAndClose(2);

      expect(order.id).toBeDefined();
      expect(await stockOf(ingredient.id)).toBe(10);
    });
  });

  describe('movimientos manuales', () => {
    it('una entrada sube el stock y deja el proveedor en el movimiento', async () => {
      const ingredient = await createIngredient({ initialStock: 0 });
      const supplier = await http()
        .post('/api/inventory/suppliers')
        .set('Cookie', admin)
        .send({ name: 'Distribuidora Central' })
        .expect(201);

      await http()
        .post('/api/inventory/movements')
        .set('Cookie', admin)
        .send({
          ingredientId: ingredient.id,
          type: 'entry',
          quantity: 40,
          supplierId: supplier.body.id,
          costPerUnit: 2.5,
        })
        .expect(201);

      expect(await stockOf(ingredient.id)).toBe(40);
      const rows = await ds.query(
        `SELECT supplier_id, previous_stock, new_stock FROM stock_movements
          WHERE ingredient_id = $1 AND type = 'entry'`,
        [ingredient.id],
      );
      expect(rows[0].supplier_id).toBe(supplier.body.id);
      expect(Number(rows[0].previous_stock)).toBe(0);
      expect(Number(rows[0].new_stock)).toBe(40);
    });

    it('el costo se promedia ponderado con lo que ya había', async () => {
      const ingredient = await createIngredient({ initialStock: 0, costPerUnit: 0 });
      const entry = (quantity: number, costPerUnit: number) =>
        http()
          .post('/api/inventory/movements')
          .set('Cookie', admin)
          .send({ ingredientId: ingredient.id, type: 'entry', quantity, costPerUnit })
          .expect(201);

      await entry(10, 2);
      await entry(10, 4);

      const rows = await ds.query(`SELECT cost_per_unit FROM ingredients WHERE id = $1`, [
        ingredient.id,
      ]);
      expect(Number(rows[0].cost_per_unit)).toBe(3);
    });

    it('una merma sin motivo se rechaza: un descuadre sin explicación no se puede auditar', async () => {
      const ingredient = await createIngredient();

      const res = await http()
        .post('/api/inventory/movements')
        .set('Cookie', admin)
        .send({ ingredientId: ingredient.id, type: 'waste', quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/motivo/i);
    });

    /**
     * `consumption` no se puede pedir por API: lo escribe solo el cierre de cuenta, con su
     * orden detrás. Abrirlo permitiría fabricar consumos sin venta y descuadrar el inventario
     * contra las ventas sin dejar rastro de por qué.
     */
    it('no se puede registrar un consumo a mano', async () => {
      const ingredient = await createIngredient();

      const res = await http()
        .post('/api/inventory/movements')
        .set('Cookie', admin)
        .send({ ingredientId: ingredient.id, type: 'consumption', quantity: 1 });

      expect(res.status).toBe(400);
    });

    it('el stock inicial entra como movimiento, no como número que aparece de la nada', async () => {
      const ingredient = await createIngredient({ initialStock: 7 });

      expect(await movementsOf(ingredient.id)).toEqual([{ type: 'adjustment', quantity: 7 }]);
    });
  });

  describe('alerta de stock mínimo', () => {
    it('avisa al cruzar el mínimo y no repite en cada venta posterior', async () => {
      const ingredient = await createIngredient({ initialStock: 10, minimumStock: 5 });
      await setRecipe(ingredient.id, 3);

      const alerts = async () =>
        Number(
          (await ds.query(`SELECT count(*)::int AS n FROM notifications WHERE type = 'stock_alert'`))[0]
            .n,
        );

      // 10 → 7: sigue por encima del mínimo, no hay nada que avisar.
      await sellAndClose(1);
      expect(await alerts()).toBe(0);

      // 7 → 4: cruza. Aquí sí.
      await sellAndClose(1);
      expect(await alerts()).toBeGreaterThan(0);

      // 4 → 1: ya estaba por debajo. Sin esta condición, un ingrediente agotado generaría
      // una notificación por cada plato durante el resto del servicio.
      const afterCrossing = await alerts();
      await sellAndClose(1);
      expect(await alerts()).toBe(afterCrossing);
    });

    it('un mínimo en cero significa «no me avises», no «avísame siempre»', async () => {
      const ingredient = await createIngredient({ initialStock: 2, minimumStock: 0 });
      await setRecipe(ingredient.id, 1);

      await sellAndClose(1);

      const rows = await ds.query(
        `SELECT count(*)::int AS n FROM notifications WHERE type = 'stock_alert'`,
      );
      expect(rows[0].n).toBe(0);
    });
  });

  describe('recetas', () => {
    it('se reemplazan enteras y rechazan un ingrediente repetido', async () => {
      const a = await createIngredient();

      await setRecipe(a.id, 1);
      const res = await http()
        .put(`/api/inventory/recipes/${product.id}`)
        .set('Cookie', admin)
        .send({
          lines: [
            { ingredientId: a.id, quantity: 1 },
            { ingredientId: a.id, quantity: 2 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/dos veces/i);
    });

    it('una lista vacía deja el producto sin receta, que es un estado válido', async () => {
      const a = await createIngredient({ initialStock: 5 });
      await setRecipe(a.id, 1);

      await http()
        .put(`/api/inventory/recipes/${product.id}`)
        .set('Cookie', admin)
        .send({ lines: [] })
        .expect(200);

      await sellAndClose(1);
      expect(await stockOf(a.id)).toBe(5);
    });
  });
});
