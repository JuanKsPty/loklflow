import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { sessionAs } from '../../test/fixtures';

/**
 * Importación del catálogo desde un CSV.
 *
 * El archivo lo lee y lo previsualiza el navegador; aquí llega ya como JSON validado. Lo que esta
 * suite protege es lo que solo se puede comprobar contra la base: que reimportar el mismo archivo
 * no duplique nada **ni ensucie el libro mayor**, que una fila mala no tumbe la tanda, y que las
 * rutas literales no las capture el comodín de `:id`.
 */
describe('Importación de productos', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  const creados = new Set<string>();
  let seq = 0;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'menu:create',
      'menu:update',
      'menu:read',
      'inventory:create',
      'inventory:read',
      'inventory:update',
    ]);
  });

  afterAll(async () => {
    if (creados.size > 0) {
      const ids = [...creados];
      await ds.query(
        `DELETE FROM stock_movements WHERE ingredient_id IN
           (SELECT id FROM ingredients WHERE product_id = ANY($1::uuid[]))`,
        [ids],
      );
      await ds.query(`DELETE FROM ingredients WHERE product_id = ANY($1::uuid[])`, [ids]);
      await ds.query(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await ds.query(`DELETE FROM categories WHERE name LIKE 'Importada %'`);
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  interface Resultado {
    created: number;
    updated: number;
    failed: number;
    categoriesCreated: string[];
    rows: { line: number; name: string; status: string; reason?: string; productId?: string }[];
  }

  async function importar(
    rows: Record<string, unknown>[],
    opciones: Record<string, unknown> = {},
    cookie = admin,
  ) {
    const res = await http()
      .post('/api/menu/products/import')
      .set('Cookie', cookie)
      .send({ rows, ...opciones });
    if (res.status === 201 || res.status === 200) {
      for (const fila of (res.body as Resultado).rows) {
        if (fila.productId) creados.add(fila.productId);
      }
    }
    return res;
  }

  const fila = (over: Record<string, unknown> = {}) => ({
    line: ++seq + 1,
    name: `Importado ${seq}`,
    price: 10,
    ...over,
  });

  it('crea lo que no existe y devuelve la línea del archivo', async () => {
    const f = fila({ line: 34 });
    const res = await importar([f]);

    expect(res.status).toBe(201);
    const body = res.body as Resultado;
    expect(body).toMatchObject({ created: 1, updated: 0, failed: 0 });
    // La del archivo, no el índice del lote: es lo que el usuario ve al abrirlo en Excel.
    expect(body.rows[0]).toMatchObject({ line: 34, status: 'created' });
  });

  it('y actualiza lo que ya está, casando por nombre sin importar mayúsculas', async () => {
    const nombre = `Importado mayúsculas ${Date.now()}`;
    await importar([fila({ name: nombre, price: 10 })]);
    const res = await importar([fila({ name: nombre.toUpperCase(), price: 25 })]);

    const body = res.body as Resultado;
    expect(body).toMatchObject({ created: 0, updated: 1 });

    const [p] = await ds.query(`SELECT price FROM products WHERE id = $1`, [
      body.rows[0].productId,
    ]);
    expect(Number(p.price)).toBe(25);
  });

  it('una fila mala no tumba la tanda', async () => {
    const res = await importar([
      fila(),
      fila({ categoryName: 'Categoría que no existe' }),
      fila(),
    ]);

    const body = res.body as Resultado;
    expect(body).toMatchObject({ created: 2, failed: 1 });
    expect(body.rows[1].reason).toMatch(/categoría/i);
  });

  it('crea las categorías que faltan solo si se pide', async () => {
    const categoria = `Importada ${Date.now()}`;
    const sinPedir = await importar([fila({ categoryName: categoria })]);
    expect((sinPedir.body as Resultado).failed).toBe(1);

    const pidiendo = await importar([fila({ categoryName: categoria })], {
      createMissingCategories: true,
    });
    const body = pidiendo.body as Resultado;
    expect(body.created).toBe(1);
    expect(body.categoriesCreated).toEqual([categoria]);
  });

  it('dos filas de la misma tanda con la misma categoría nueva no crean dos categorías', async () => {
    // Se crean antes del bucle, una vez por nombre distinto: dentro de la fila se duplicarían.
    const categoria = `Importada doble ${Date.now()}`;
    const res = await importar(
      [fila({ categoryName: categoria }), fila({ categoryName: categoria })],
      { createMissingCategories: true },
    );

    expect((res.body as Resultado).categoriesCreated).toEqual([categoria]);
    const filas = await ds.query(`SELECT id FROM categories WHERE name = $1`, [categoria]);
    expect(filas).toHaveLength(1);
  });

  it('deja las existencias puestas cuando la fila las trae', async () => {
    const res = await importar([fila({ stock: 24, minimumStock: 5 })]);
    const productId = (res.body as Resultado).rows[0].productId!;

    const [i] = await ds.query(
      `SELECT current_stock, minimum_stock FROM ingredients WHERE product_id = $1`,
      [productId],
    );
    expect(Number(i.current_stock)).toBe(24);
    expect(Number(i.minimum_stock)).toBe(5);
  });

  /**
   * El caso que hace que una importación a medias se pueda recuperar volviendo a pasar el mismo
   * archivo — que es toda la estrategia de recuperación de esta funcionalidad.
   */
  it('reimportar el mismo archivo no duplica ni ensucia el libro mayor', async () => {
    const nombre = `Importado reimportable ${Date.now()}`;
    const primera = await importar([fila({ name: nombre, stock: 12 })]);
    const productId = (primera.body as Resultado).rows[0].productId!;

    const segunda = await importar([fila({ name: nombre, stock: 12 })]);
    expect((segunda.body as Resultado)).toMatchObject({ created: 0, updated: 1, failed: 0 });

    const productos = await ds.query(`SELECT id FROM products WHERE name = $1`, [nombre]);
    expect(productos).toHaveLength(1);

    // Y **ni un movimiento de cantidad cero**: sin esa comprobación, reimportar llenaría el
    // historial de ajustes que no explican nada, que es lo que lo vuelve inútil.
    const movimientos = await ds.query(
      `SELECT quantity FROM stock_movements
        WHERE ingredient_id = (SELECT id FROM ingredients WHERE product_id = $1)`,
      [productId],
    );
    expect(movimientos).toHaveLength(1);
    expect(Number(movimientos[0].quantity)).toBe(12);
  });

  it('sin permiso de inventario, una fila con existencias falla pero el resto entra', async () => {
    const soloMenu = await sessionAs(app, 'admin@loklflow.com', ['menu:create', 'menu:update']);
    const res = await importar([fila(), fila({ stock: 5 })], {}, soloMenu);

    const body = res.body as Resultado;
    expect(body).toMatchObject({ created: 1, failed: 1 });
    expect(body.rows[1].reason).toMatch(/permiso/i);
  });

  it('exige menu:create y menu:update: con uno solo responde 403', async () => {
    const soloCrear = await sessionAs(app, 'admin@loklflow.com', ['menu:create']);
    const res = await importar([fila()], {}, soloCrear);
    expect(res.status).toBe(403);
  });

  it('rechaza una clave que no está en el DTO, en vez de ignorarla', async () => {
    // `forbidNonWhitelisted`: por eso el cuerpo se construye campo a campo en el cliente.
    const res = await importar([{ ...fila(), colorFavorito: 'azul' }]);
    expect(res.status).toBe(400);
  });

  it('rechaza una tanda de más de 200 filas', async () => {
    const res = await importar(Array.from({ length: 201 }, () => fila()));
    expect(res.status).toBe(400);
  });

  describe('plantilla y exportación', () => {
    it('la plantilla se descarga como CSV, con BOM y la directiva de Excel', async () => {
      const res = await http()
        .get('/api/menu/products/import-template.csv')
        .set('Cookie', admin)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/plantilla-productos\.csv/);
      // Sin el BOM, el Excel de Windows lee Latin-1 y destroza los acentos.
      expect(res.text.startsWith('﻿')).toBe(true);
      expect(res.text).toContain('sep=,');
      expect(res.text).toContain('nombre,descripcion,precio');
    });

    it('la plantilla trae la fila de ejemplo que el lector sabe detectar', async () => {
      const res = await http()
        .get('/api/menu/products/import-template.csv')
        .set('Cookie', admin)
        .expect(200);
      expect(res.text).toContain('BORRA ESTA FILA (ejemplo)');
    });

    it('la exportación devuelve el catálogo en el mismo formato', async () => {
      const nombre = `Importado exportable ${Date.now()}`;
      await importar([fila({ name: nombre, price: 42, station: 'bar' })]);

      const res = await http()
        .get('/api/menu/products/export.csv')
        .set('Cookie', admin)
        .expect(200);

      expect(res.text).toContain(nombre);
      // En el idioma en que se importa, para que la ida y vuelta sea exacta.
      expect(res.text).toContain('barra');
    });

    /**
     * `@Get(':id')` está declarado con `ParseUuidPipe`. Si estas rutas quedaran después, las
     * capturaría el comodín y la respuesta sería un 400 sobre un uuid.
     */
    it('las rutas literales no las captura el comodín de :id', async () => {
      await http().get('/api/menu/products/export.csv').set('Cookie', admin).expect(200);
      await http().get('/api/menu/products/import-template.csv').set('Cookie', admin).expect(200);
    });
  });
});
