import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';
import { seededUser } from '../../test/fixtures';

/** Lee el payload de un JWT sin verificarlo: basta para comprobar claims y duración. */
function decode(token: string): { loginMethod: string; iat: number; exp: number } {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

function cookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

function tokenOf(res: request.Response, name: string): string {
  const found = cookie(res, name);
  if (!found) throw new Error(`La respuesta no trae la cookie ${name}`);
  return found.split(';')[0].split('=')[1];
}

/**
 * La sesión por PIN es la que usan mesero, cocina y caja. Estos casos cubren el agujero que
 * la dejaba sin salida: no recibía token de refresco, así que a las cuatro horas exactas el
 * operario quedaba fuera **en operación normal**, porque un turno dura más que eso.
 */
describe('Sesión', () => {
  let app: INestApplication;
  let waiterId: string;

  beforeAll(async () => {
    app = await createTestApp();
    waiterId = (await seededUser(app, 'mesero@loklflow.com')).id;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());

  const pinLogin = () =>
    http().post('/api/auth/pin').send({ userId: waiterId, pin: '1234' });

  it('el login por PIN entrega también token de refresco', async () => {
    const res = await pinLogin().expect(200);

    expect(cookie(res, 'access_token')).toBeDefined();
    // Esta es la que faltaba: sin ella no había forma de renovar la sesión.
    expect(cookie(res, 'refresh_token')).toBeDefined();
  });

  it('el acceso por PIN dura cuatro horas, no quince minutos', async () => {
    const res = await pinLogin().expect(200);
    const { loginMethod, iat, exp } = decode(tokenOf(res, 'access_token'));

    expect(loginMethod).toBe('pin');
    expect(exp - iat).toBe(4 * 60 * 60);
  });

  it('refrescar una sesión por PIN la mantiene por PIN y con sus cuatro horas', async () => {
    // El bug: `refresh()` fijaba loginMethod a 'email', así que el primer refresco degradaba
    // el token de cuatro horas a quince minutos y falseaba el método en la bitácora.
    const login = await pinLogin().expect(200);

    const refreshed = await http()
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${tokenOf(login, 'refresh_token')}`)
      .expect(200);

    const { loginMethod, iat, exp } = decode(tokenOf(refreshed, 'access_token'));
    expect(loginMethod).toBe('pin');
    expect(exp - iat).toBe(4 * 60 * 60);
    expect(cookie(refreshed, 'refresh_token')).toBeDefined();
  });

  it('el refresco por PIN abre una ventana más corta que el de email', async () => {
    // Un PIN son cuatro dígitos: no debe abrir una sesión renovable durante una semana.
    const pin = await pinLogin().expect(200);
    const pinRefresh = decode(tokenOf(pin, 'refresh_token'));

    const email = await http()
      .post('/api/auth/login')
      .send({ email: 'admin@loklflow.com', password: 'Admin1234!' })
      .expect(200);
    const emailRefresh = decode(tokenOf(email, 'refresh_token'));

    expect(pinRefresh.exp - pinRefresh.iat).toBe(12 * 60 * 60);
    expect(emailRefresh.exp - emailRefresh.iat).toBeGreaterThan(pinRefresh.exp - pinRefresh.iat);
  });

  it('un token de refresco ya usado no vale una segunda vez', async () => {
    const login = await pinLogin().expect(200);
    const refresh = tokenOf(login, 'refresh_token');

    await http()
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refresh}`)
      .expect(200);

    await http()
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refresh}`)
      .expect(401);
  });

  it('rechaza un PIN incorrecto', async () => {
    await http().post('/api/auth/pin').send({ userId: waiterId, pin: '9999' }).expect(401);
  });
});
