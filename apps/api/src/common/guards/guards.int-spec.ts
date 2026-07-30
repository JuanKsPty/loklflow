import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, cookieFor, createTestApp } from '../../../test/app';

/**
 * `JwtAuthGuard` y `PermissionsGuard` están registrados como `APP_GUARD`, así que el
 * comportamiento por defecto de toda la API es denegar. Eso no lo cubría ningún test: los
 * unitarios llaman a los servicios directamente, saltándose los guards por completo.
 */
describe('Guards globales', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('deja pasar /api/health sin credenciales', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('responde 401 en una ruta protegida cuando no hay sesión', async () => {
    const res = await request(app.getHttpServer()).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('responde 401 si la cookie lleva un token que no verifica', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Cookie', 'access_token=esto.no.es.un.jwt');
    expect(res.status).toBe(401);
  });

  it('responde 403 con sesión válida pero sin el permiso exigido', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Cookie', cookieFor([]));
    expect(res.status).toBe(403);
  });

  it('responde 403 cuando el permiso es parecido pero no el que se pide', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Cookie', cookieFor(['orders:create']));
    expect(res.status).toBe(403);
  });

  it('deja pasar con el permiso declarado en el endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Cookie', cookieFor(['orders:read']));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('acepta el token también por cabecera Authorization', async () => {
    const token = cookieFor(['orders:read']).replace('access_token=', '');
    const res = await request(app.getHttpServer())
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
