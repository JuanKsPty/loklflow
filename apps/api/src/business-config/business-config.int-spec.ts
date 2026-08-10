import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { sessionAs } from '../../test/fixtures';

/**
 * Configuración del negocio.
 *
 * Es una fila única de la que cuelgan el recibo, la moneda, el impuesto y —desde el menú QR— la
 * **zona horaria con la que se decide si un producto está disponible**. Dos cosas que comprobar:
 * que `GET` la cree si falta en vez de devolver 404 (un 404 ahí solo produce una página rota), y
 * que `PUT` no cree una segunda.
 */
describe('Configuración del negocio', () => {
  let app: INestApplication;
  let ds: DataSource;
  let admin: string;
  let original: Record<string, unknown>;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);
    admin = await sessionAs(app, 'admin@loklflow.com', [
      'business_config:read',
      'business_config:update',
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/business-config')
      .set('Cookie', admin)
      .expect(200);
    original = res.body;
  });

  afterAll(async () => {
    // La fila es compartida con el resto de suites: se deja como estaba.
    await request(app.getHttpServer())
      .put('/api/business-config')
      .set('Cookie', admin)
      .send({
        businessName: original.businessName,
        currency: original.currency,
        taxRate: Number(original.taxRate),
        timezone: original.timezone,
      });
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  it('se lee y trae la zona horaria del negocio', async () => {
    const res = await http().get('/api/business-config').set('Cookie', admin).expect(200);

    expect(res.body.businessName).toBeTruthy();
    expect(res.body.timezone).toBeTruthy();
  });

  it('si no existe, la crea con valores por defecto en vez de dar 404', async () => {
    await ds.query(`DELETE FROM business_config`);

    const res = await http().get('/api/business-config').set('Cookie', admin).expect(200);
    expect(res.body.businessName).toBe('Mi Negocio');
  });

  it('el PUT edita la que hay, no crea otra', async () => {
    await http()
      .put('/api/business-config')
      .set('Cookie', admin)
      .send({ businessName: 'Cantina de pruebas' })
      .expect(200);

    const rows = await ds.query(`SELECT count(*)::int AS n FROM business_config`);
    expect(rows[0].n).toBe(1);

    const res = await http().get('/api/business-config').set('Cookie', admin).expect(200);
    expect(res.body.businessName).toBe('Cantina de pruebas');
  });

  it('un cambio parcial no borra el resto', async () => {
    await http()
      .put('/api/business-config')
      .set('Cookie', admin)
      .send({ businessName: 'Cantina', currency: 'MXN', taxRate: 16 })
      .expect(200);

    const res = await http()
      .put('/api/business-config')
      .set('Cookie', admin)
      .send({ receiptFooter: 'Gracias por su visita' })
      .expect(200);

    expect(res.body).toMatchObject({ businessName: 'Cantina', currency: 'MXN' });
    expect(Number(res.body.taxRate)).toBe(16);
  });

  it('una moneda que no tiene tres letras se rechaza', async () => {
    await http()
      .put('/api/business-config')
      .set('Cookie', admin)
      .send({ currency: 'PESOS' })
      .expect(400);
  });

  it('un impuesto por encima de 100 se rechaza', async () => {
    await http()
      .put('/api/business-config')
      .set('Cookie', admin)
      .send({ taxRate: 120 })
      .expect(400);
  });

  it('un campo desconocido se rechaza en vez de ignorarse', async () => {
    await http()
      .put('/api/business-config')
      .set('Cookie', admin)
      .send({ nombreDelNegocio: 'mal escrito' })
      .expect(400);
  });

  it('leer y escribir exigen permisos distintos', async () => {
    const soloLectura = await sessionAs(app, 'mesero@loklflow.com', ['business_config:read']);

    await http().get('/api/business-config').set('Cookie', soloLectura).expect(200);
    await http()
      .put('/api/business-config')
      .set('Cookie', soloLectura)
      .send({ businessName: 'No debería' })
      .expect(403);
  });
});
