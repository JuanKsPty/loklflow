import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from '../../test/app';

/**
 * Las cabeceras de seguridad, comprobadas sobre la aplicación real.
 *
 * `createTestApp()` replica los globales de `main.ts` a mano, así que estas afirmaciones valen
 * exactamente lo que valga esa réplica: si alguien añade algo a `main.ts` y no al arnés, aquí se
 * ve. Es la misma razón por la que el id de petición se registra desde el módulo y no con
 * `app.use()`.
 */
describe('cabeceras de seguridad', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  const health = () => request(app.getHttpServer()).get('/api/health');

  it('no anuncia la pila con X-Powered-By', async () => {
    const res = await health().expect(200);

    // Express lo pone por defecto. Decirle a quien pregunta con qué está hecho el servidor es
    // regalo gratis para quien busca una vulnerabilidad conocida.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('impide que el navegador adivine el tipo de contenido', async () => {
    const res = await health().expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('no se puede meter la API en un iframe', async () => {
    const res = await health().expect(200);

    expect(res.headers['x-frame-options']?.toLowerCase()).toBe('deny');
  });

  it('no filtra la URL completa al navegar fuera', async () => {
    const res = await health().expect(200);

    expect(res.headers['referrer-policy']).toBeDefined();
  });

  /**
   * **La cabecera que necesita su propio test.**
   *
   * El valor por defecto de helmet es `same-origin`, y en desarrollo el web está en `:3000` y la
   * API en `:3001`. Pegar los defaults rompería la aplicación entera en el entorno donde se
   * trabaja todos los días, y el fallo aparecería como recursos que no cargan sin ningún error de
   * servidor. Es exactamente el tipo de cosa que se «arregla» quitando helmet entero.
   */
  it('permite que el front de otro puerto lea las respuestas', async () => {
    const res = await health().expect(200);

    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  /**
   * El CSP de la API está apagado a propósito: sirve JSON, y su única superficie HTML —Swagger—
   * lleva un `<script>` en línea que el CSP por defecto de helmet mata. El CSP que importa es el
   * del front, que sí sirve HTML.
   */
  it('la API no manda CSP: el que importa es el del front', async () => {
    const res = await health().expect(200);

    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
