import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../test/app';

/**
 * Salud, disponibilidad e id de petición contra la aplicación real.
 *
 * El id merece un test de integración y no uno unitario porque lo que puede romperse no es la
 * función: es que el middleware esté registrado. Vive en `AppModule.configure()` justo para
 * que `createTestApp()` lo monte igual que `main.ts`; si alguien lo mueve a un `app.use()`,
 * esto se cae aquí y no en producción.
 */
describe('Salud y trazabilidad', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('/api/health', () => {
    it('sigue siendo una respuesta constante que no toca la base', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('/api/ready', () => {
    it('con la base viva responde 200', async () => {
      const res = await request(app.getHttpServer()).get('/api/ready');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', database: 'up' });
    });

    it('es público, como /health: una sonda externa no tiene credenciales', async () => {
      const res = await request(app.getHttpServer()).get('/api/ready');

      expect(res.status).not.toBe(401);
    });
  });

  describe('x-request-id', () => {
    it('va en toda respuesta, también en las correctas', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');

      expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9_.:-]{8,64}$/);
    });

    it('respeta el que venga de fuera, para poder seguir una llamada entre servicios', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .set('x-request-id', 'trace-0001');

      expect(res.headers['x-request-id']).toBe('trace-0001');
    });

    it.each([
      ['demasiado corto', 'abc'],
      ['con espacios, que en un log valen por saltos de línea', 'id falso 2026'],
      ['descomunal', 'x'.repeat(200)],
    ])('descarta un id %s y genera uno propio', async (_caso, value) => {
      const res = await request(app.getHttpServer()).get('/api/health').set('x-request-id', value);

      expect(res.headers['x-request-id']).not.toBe(value);
      expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9_.:-]{8,64}$/);
    });

    it('el cuerpo de un error lleva el mismo id que la cabecera', async () => {
      const res = await request(app.getHttpServer()).get('/api/orders');

      expect(res.status).toBe(401);
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });
  });
});
