import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';

/**
 * El límite de peticiones de las rutas de sesión.
 *
 * Lo que se comprueba no es solo que limite, sino **dónde no limita**: un límite global
 * estrangularía el local entero, porque para la API las 42 pantallas del negocio son una sola
 * IP —`serverFetch` corre en el proceso de Next— y la cola sin conexión reenvía en ráfaga.
 */
describe('límite de peticiones', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const http = () => request(app.getHttpServer());
  const uuid = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

  it('corta el machaqueo del PIN de un mismo usuario', async () => {
    const target = uuid(11);
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await http().post('/api/auth/pin').send({ userId: target, pin: '0000' });
      codes.push(res.status);
    }

    // Los primeros fallan por credenciales; a partir del tope, por límite.
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    expect(codes[0]).not.toBe(429);
  });

  /**
   * El motivo de que la clave lleve **a quién** se intenta entrar y no solo la IP: en un local
   * todos los dispositivos comparten IP a ojos de la API, y contar solo por IP haría que un
   * cajero que se equivoca bloqueara al mesero de la mesa de al lado.
   */
  it('el machaqueo de un usuario no bloquea a otro desde la misma IP', async () => {
    const victima = uuid(21);
    for (let i = 0; i < 12; i++) {
      await http().post('/api/auth/pin').send({ userId: victima, pin: '0000' });
    }

    const otro = await http().post('/api/auth/pin').send({ userId: uuid(22), pin: '0000' });

    expect(otro.status).not.toBe(429);
  });

  it('el mensaje no dice cuántos intentos quedan ni cuándo volver', async () => {
    const target = uuid(31);
    let limited: request.Response | undefined;
    for (let i = 0; i < 15 && !limited; i++) {
      const res = await http().post('/api/auth/pin').send({ userId: target, pin: '0000' });
      if (res.status === 429) limited = res;
    }

    expect(limited).toBeDefined();
    // Un «te quedan 2 intentos» le confirma a quien prueba que la cuenta existe y le dice
    // exactamente cuándo volver.
    const body = JSON.stringify(limited!.body);
    expect(body).not.toMatch(/\d+\s*(intento|restante|segundo)/i);
  });

  /**
   * La parte que protege al negocio de su propia defensa. Si estas rutas estuvieran limitadas,
   * un evento de tiempo real —que recarga a todos los clientes— o la ráfaga de reconexión de una
   * tablet con la cola llena dispararían el tope, y `outbox` acabaría mandando comandas a la
   * bandeja de fallos por defenderse de un ataque que nadie estaba haciendo.
   */
  it('las rutas de lectura no están limitadas', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) {
      const res = await http().get('/api/orders');
      codes.push(res.status);
    }

    // Sin sesión son 401, no 429: llegan al guard de autenticación, no al del límite.
    expect(codes.every((c) => c === 401)).toBe(true);
  });

  it('el healthcheck de la imagen nunca se limita', async () => {
    // Lo llama el HEALTHCHECK del contenedor cada 30 s y el job `images` de CI en bucle. Un 429
    // aquí reiniciaría un contenedor sano.
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) {
      const res = await http().get('/api/health');
      codes.push(res.status);
    }

    expect(codes.every((c) => c === 200)).toBe(true);
  });
});
