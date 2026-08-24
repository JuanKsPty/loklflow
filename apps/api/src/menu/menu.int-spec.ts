import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { sessionAs } from '../../test/fixtures';

/**
 * Catálogo: categorías, productos, modificadores y combos.
 *
 * `resetOperationalData` deja el catálogo intacto a propósito —el seed lo siembra una vez—, así
 * que esta suite limpia lo suyo en `afterAll`. Lo que se comprueba no es el CRUD: es que un id
 * inexistente salga como 400 y no como un 500 de clave ajena, y que reemplazar los horarios de
 * un producto no deje huérfanos.
 */
describe('Catálogo del menú', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;

  const productos: string[] = [];
  const categorias: string[] = [];
  const modificadores: string[] = [];
  const combos: string[] = [];

  const UUID_INEXISTENTE = '00000000-0000-4000-8000-000000000999';

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'menu:create',
      'menu:read',
      'menu:update',
      'menu:delete',
    ]);
  });

  afterAll(async () => {
    if (combos.length > 0) {
      await ds.query(`DELETE FROM "combos" WHERE id = ANY($1::uuid[])`, [combos]);
    }
    if (productos.length > 0) {
      await ds.query(`DELETE FROM "products" WHERE id = ANY($1::uuid[])`, [productos]);
    }
    if (modificadores.length > 0) {
      await ds.query(`DELETE FROM "modifiers" WHERE id = ANY($1::uuid[])`, [modificadores]);
    }
    if (categorias.length > 0) {
      await ds.query(`DELETE FROM "categories" WHERE id = ANY($1::uuid[])`, [categorias]);
    }
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  let seq = 0;
  async function newCategory() {
    const res = await http()
      .post('/api/menu/categories')
      .set('Cookie', admin)
      .send({ name: `Categoría de prueba ${++seq}` })
      .expect(201);
    categorias.push(res.body.id);
    return res.body as { id: string };
  }

  async function newModifier(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/menu/modifiers')
      .set('Cookie', admin)
      .send({
        name: `Modificador ${++seq}`,
        options: [
          { name: 'Sin cebolla', priceAdjustment: 0 },
          { name: 'Extra queso', priceAdjustment: 15 },
        ],
        ...body,
      })
      .expect(201);
    modificadores.push(res.body.id);
    return res.body as { id: string; options: { id: string; name: string }[] };
  }

  async function newProduct(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/menu/products')
      .set('Cookie', admin)
      .send({ name: `Producto de prueba ${++seq}`, price: 100, ...body })
      .expect(201);
    productos.push(res.body.id);
    return res.body as { id: string };
  }

  describe('categorías', () => {
    it('se crean, se leen y se editan', async () => {
      const cat = await newCategory();

      const listado = await http().get('/api/menu/categories').set('Cookie', admin).expect(200);
      expect((listado.body as { id: string }[]).some((c) => c.id === cat.id)).toBe(true);

      const editada = await http()
        .patch(`/api/menu/categories/${cat.id}`)
        .set('Cookie', admin)
        .send({ description: 'Para las pruebas' })
        .expect(200);
      expect(editada.body.description).toBe('Para las pruebas');
    });

    it('una que no existe da 404', async () => {
      await http()
        .get(`/api/menu/categories/${UUID_INEXISTENTE}`)
        .set('Cookie', admin)
        .expect(404);
    });
  });

  describe('modificadores', () => {
    it('nacen con sus opciones y las devuelven al leerlos', async () => {
      // Es la trampa que ya costó una vez: sin `options`, un grupo obligatorio llega vacío y el
      // producto no se puede pedir desde ninguna pantalla.
      const mod = await newModifier();

      const leido = await http()
        .get(`/api/menu/modifiers/${mod.id}`)
        .set('Cookie', admin)
        .expect(200);
      expect(leido.body.options).toHaveLength(2);
      expect(leido.body.options.map((o: { name: string }) => o.name)).toEqual(
        expect.arrayContaining(['Sin cebolla', 'Extra queso']),
      );
    });

    it('editar las opciones las reemplaza, no las acumula', async () => {
      const mod = await newModifier();

      const editado = await http()
        .patch(`/api/menu/modifiers/${mod.id}`)
        .set('Cookie', admin)
        .send({ options: [{ name: 'Solo una', priceAdjustment: 0 }] })
        .expect(200);

      expect(editado.body.options).toHaveLength(1);
    });
  });

  describe('productos', () => {
    /**
     * Un id de modificador que no existe llegaría al `INSERT` de la tabla puente y saldría como
     * **500**. Es un dato que manda el formulario, o sea un 400.
     */
    it('un modificador inexistente da 400, no 500', async () => {
      const res = await http()
        .post('/api/menu/products')
        .set('Cookie', admin)
        .send({ name: 'Producto imposible', price: 50, modifierIds: [UUID_INEXISTENTE] })
        .expect(400);

      expect(String(res.body.message)).toMatch(/modificadores no existen/i);
    });

    it('la misma comprobación al editar', async () => {
      const prod = await newProduct();

      await http()
        .patch(`/api/menu/products/${prod.id}`)
        .set('Cookie', admin)
        .send({ modifierIds: [UUID_INEXISTENTE] })
        .expect(400);
    });

    it('se le enganchan modificadores y vienen con sus opciones', async () => {
      const mod = await newModifier();
      const prod = await newProduct({ modifierIds: [mod.id] });

      const listado = await http().get('/api/menu/products').set('Cookie', admin).expect(200);
      const mio = (listado.body as { id: string; modifiers: { options: unknown[] }[] }[]).find(
        (p) => p.id === prod.id,
      );

      expect(mio?.modifiers).toHaveLength(1);
      expect(mio?.modifiers[0].options).toHaveLength(2);
    });

    it('reemplazar los horarios no deja huérfanos', async () => {
      const prod = await newProduct({
        availabilities: [
          { dayOfWeek: 1, startTime: '07:00', endTime: '11:00' },
          { dayOfWeek: 2, startTime: '07:00', endTime: '11:00' },
        ],
      });

      await http()
        .patch(`/api/menu/products/${prod.id}`)
        .set('Cookie', admin)
        .send({ availabilities: [{ dayOfWeek: 5, startTime: '22:00', endTime: '02:00' }] })
        .expect(200);

      // Contra la base y no contra la respuesta: lo que se comprueba es que las dos filas viejas
      // se borraron de verdad, no que la relación cargada las omita.
      const rows = await ds.query(
        `SELECT day_of_week AS "dayOfWeek" FROM product_availabilities WHERE product_id = $1`,
        [prod.id],
      );
      expect(rows).toEqual([{ dayOfWeek: 5 }]);
    });

    it('un horario con formato malo se rechaza', async () => {
      await http()
        .post('/api/menu/products')
        .set('Cookie', admin)
        .send({
          name: 'Con horario torcido',
          price: 10,
          availabilities: [{ dayOfWeek: 1, startTime: '7:00', endTime: '11:00' }],
        })
        .expect(400);
    });

    it('un precio negativo se rechaza', async () => {
      await http()
        .post('/api/menu/products')
        .set('Cookie', admin)
        .send({ name: 'Gratis y encima pagan', price: -1 })
        .expect(400);
    });

    it('más de dos decimales en el precio se rechaza', async () => {
      // No hay moneda que se cobre en milésimas; aceptarlo redondearía en algún punto opaco.
      await http()
        .post('/api/menu/products')
        .set('Cookie', admin)
        .send({ name: 'Precio raro', price: 10.999 })
        .expect(400);
    });

    it('el listado de admin incluye los inactivos', async () => {
      // `findAll()` sin opciones no filtra nada, y es deliberado: `/admin/menu/products` tiene
      // que poder reactivar lo que desactivó.
      const prod = await newProduct({ isActive: false });

      const listado = await http().get('/api/menu/products').set('Cookie', admin).expect(200);
      expect((listado.body as { id: string }[]).some((p) => p.id === prod.id)).toBe(true);
    });

    /**
     * `station` estaba en el DTO, en la entidad y en la columna, y **el servicio no lo copiaba
     * ni al crear ni al editar**: todo producto de la API acababa en `kitchen`. El formulario
     * web sí lo mandaba, así que una bebida sonaba en cocina y el KDS pintaba una tarjeta que
     * nadie tenía que preparar. Se prueban los dos caminos porque faltaba en los dos.
     */
    it('guarda la estación que se eligió, al crear y al editar', async () => {
      const prod = await newProduct({ station: 'bar' });
      expect((prod as unknown as { station: string }).station).toBe('bar');

      const editado = await http()
        .patch(`/api/menu/products/${prod.id}`)
        .set('Cookie', admin)
        .send({ station: 'immediate' })
        .expect(200);
      expect((editado.body as { station: string }).station).toBe('immediate');

      const leido = await http()
        .get(`/api/menu/products/${prod.id}`)
        .set('Cookie', admin)
        .expect(200);
      expect((leido.body as { station: string }).station).toBe('immediate');
    });

    it('se borra', async () => {
      const prod = await newProduct();
      await http().delete(`/api/menu/products/${prod.id}`).set('Cookie', admin).expect(204);
      await http().get(`/api/menu/products/${prod.id}`).set('Cookie', admin).expect(404);
    });

    it('exige permiso para escribir', async () => {
      const soloLectura = await sessionAs(app, 'mesero@loklflow.com', ['menu:read']);

      await http()
        .post('/api/menu/products')
        .set('Cookie', soloLectura)
        .send({ name: 'No debería existir', price: 10 })
        .expect(403);
    });
  });

  describe('combos', () => {
    async function newCombo(body: Record<string, unknown> = {}) {
      const res = await http()
        .post('/api/menu/combos')
        .set('Cookie', admin)
        .send({ name: `Combo de prueba ${++seq}`, price: 150, ...body })
        .expect(201);
      combos.push(res.body.id);
      return res.body as { id: string; items: { productId: string; quantity: number }[] };
    }

    it('se arma con sus productos y cantidades', async () => {
      const a = await newProduct();
      const b = await newProduct();

      const combo = await newCombo({
        items: [
          { productId: a.id, quantity: 2 },
          { productId: b.id },
        ],
      });

      const leido = await http()
        .get(`/api/menu/combos/${combo.id}`)
        .set('Cookie', admin)
        .expect(200);
      const items = leido.body.items as { productId: string; quantity: number }[];
      expect(items).toHaveLength(2);
      // El valor por defecto de `quantity` es 1: sin él, un combo con una línea sin cantidad
      // saldría a cero unidades y el cliente recibiría un plato de menos.
      expect(items.find((i) => i.productId === b.id)?.quantity).toBe(1);
    });

    it('un producto inexistente da 400, no 500', async () => {
      const res = await http()
        .post('/api/menu/combos')
        .set('Cookie', admin)
        .send({
          name: 'Combo imposible',
          price: 100,
          items: [{ productId: UUID_INEXISTENTE, quantity: 1 }],
        })
        .expect(400);

      expect(String(res.body.message)).toMatch(/productos del combo no existen/i);
    });

    it('el mismo producto repetido no cuenta dos veces al validarlo', async () => {
      // `buildItems` deduplica los ids antes de contarlos; sin eso, «dos veces el mismo plato»
      // —que es un combo perfectamente normal— saldría como «uno o más no existen».
      const a = await newProduct();

      const combo = await newCombo({
        items: [
          { productId: a.id, quantity: 1 },
          { productId: a.id, quantity: 2 },
        ],
      });
      expect(combo.items).toHaveLength(2);
    });

    it('editar los productos los reemplaza', async () => {
      const a = await newProduct();
      const b = await newProduct();
      const combo = await newCombo({ items: [{ productId: a.id, quantity: 1 }] });

      const editado = await http()
        .patch(`/api/menu/combos/${combo.id}`)
        .set('Cookie', admin)
        .send({ items: [{ productId: b.id, quantity: 3 }] })
        .expect(200);

      expect(editado.body.items).toHaveLength(1);
      expect(editado.body.items[0]).toMatchObject({ productId: b.id, quantity: 3 });
    });

    it('editar solo el precio no toca los productos', async () => {
      const a = await newProduct();
      const combo = await newCombo({ items: [{ productId: a.id, quantity: 1 }] });

      const editado = await http()
        .patch(`/api/menu/combos/${combo.id}`)
        .set('Cookie', admin)
        .send({ price: 199.5 })
        .expect(200);

      expect(Number(editado.body.price)).toBe(199.5);
      expect(editado.body.items).toHaveLength(1);
    });

    it('uno que no existe da 404', async () => {
      await http().get(`/api/menu/combos/${UUID_INEXISTENTE}`).set('Cookie', admin).expect(404);
    });

    it('se borra', async () => {
      const combo = await newCombo();
      await http().delete(`/api/menu/combos/${combo.id}`).set('Cookie', admin).expect(204);
      await http().get(`/api/menu/combos/${combo.id}`).set('Cookie', admin).expect(404);
    });
  });
});
