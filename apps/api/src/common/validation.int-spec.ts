import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, cookieFor, createTestApp } from '../../test/app';
import { firstProduct } from '../../test/fixtures';

/**
 * El `ValidationPipe` global está configurado con `whitelist`, `transform` y
 * `forbidNonWhitelisted`, así que protege los DTO de **toda** la API de una vez. Estos
 * casos lo comprueban sobre un endpoint concreto: si el pipe dejara de registrarse, la
 * superficie entera quedaría abierta y ningún test unitario lo notaría, porque llaman a
 * los servicios sin pasar por el pipe.
 */
describe('Validación global de entrada', () => {
  let app: INestApplication;
  let cookie: string;
  let productId: string;

  beforeAll(async () => {
    app = await createTestApp();
    cookie = cookieFor(['orders:create', 'orders:read']);
    productId = (await firstProduct(app)).id;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('rechaza un campo que el DTO no declara', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({
        items: [{ productId, quantity: 1 }],
        // El cliente no puede fijar el total: se calcula en el servidor.
        total: 0.01,
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('total');
  });

  it('rechaza una orden sin ítems', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  it('rechaza una cantidad que no es entera positiva', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({ items: [{ productId, quantity: 0 }] });

    expect(res.status).toBe(400);
  });

  it('rechaza un uuid mal formado en la ruta', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders/no-es-un-uuid')
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
  });

  it('devuelve 404, no 500, con un uuid válido que no existe', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders/11111111-1111-4111-8111-111111111111')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('convierte los tipos de los parámetros de consulta en lugar de fallar', async () => {
    // `transform: true` es lo que hace que un número que llega como string en la query no
    // reviente la validación del DTO.
    const res = await request(app.getHttpServer())
      .get('/api/discounts?limit=5')
      .set('Cookie', cookieFor(['pos:read']));

    expect(res.status).toBe(200);
  });
});
