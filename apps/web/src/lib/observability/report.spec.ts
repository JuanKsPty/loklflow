import { describe, expect, it } from 'vitest';
import { describeError } from './report';

/**
 * Esta función decide qué sale del navegador y del servidor de Next hacia un log. Es el
 * trozo de `apps/web` con más riesgo de fuga, y el más barato de probar: son funciones puras.
 */
describe('describeError', () => {
  it('se queda con lo justo de un Error normal', () => {
    const report = describeError(new TypeError('no se pudo leer la mesa'));

    expect(report.name).toBe('TypeError');
    expect(report.message).toBe('no se pudo leer la mesa');
    expect(report.stack).toContain('TypeError');
  });

  /**
   * El motivo de que los campos se elijan uno a uno en vez de volcar el objeto: los errores
   * de las librerías HTTP arrastran la petición entera, con la cabecera de autorización
   * dentro, y `ApiError` lleva la respuesta del servidor en `data`.
   */
  it('no arrastra las propiedades que el error traiga colgando', () => {
    const err = Object.assign(new Error('401'), {
      config: { headers: { Authorization: 'Bearer secreto-de-verdad' } },
      data: { pinHash: '$2b$10$loQueSea' },
      cookies: 'access_token=abc',
    });

    const written = JSON.stringify(describeError(err));

    expect(written).not.toContain('secreto-de-verdad');
    expect(written).not.toContain('loQueSea');
    expect(written).not.toContain('access_token');
  });

  it('sí conserva status y requestId, que son los que hacen investigable el fallo', () => {
    const err = Object.assign(new Error('API error 500'), {
      status: 500,
      requestId: 'a1b2c3d4-e5f6',
    });

    expect(describeError(err)).toMatchObject({ status: 500, requestId: 'a1b2c3d4-e5f6' });
  });

  it('tacha un JWT que se haya colado en el mensaje', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firmaQueNoDebeQuedarEscrita';
    const report = describeError(new Error(`token rechazado: ${token}`));

    expect(report.message).not.toContain('firmaQueNoDebeQuedarEscrita');
    expect(report.message).toContain('[token]');
  });

  it('recorta un mensaje desmedido en vez de escribir la línea entera', () => {
    const report = describeError(new Error('x'.repeat(5000)));

    expect(report.message.length).toBeLessThan(600);
    expect(report.message).toContain('+4500');
  });

  it('recorta la pila a unas pocas líneas', () => {
    const err = new Error('hondo');
    err.stack = ['Error: hondo', ...Array.from({ length: 80 }, (_, i) => `    at f${i} (a.ts:${i}:1)`)].join('\n');

    expect(describeError(err).stack!.split('\n')).toHaveLength(12);
  });

  it('incluye la causa, pero solo su nombre y su mensaje', () => {
    const err = new Error('no se pudo cargar el salón', {
      cause: Object.assign(new Error('ECONNREFUSED'), { secreto: 'no' }),
    });

    expect(describeError(err).cause).toBe('Error: ECONNREFUSED');
  });

  /**
   * En JavaScript se puede lanzar cualquier cosa, y el peor momento para que el reporte
   * falle es cuando ya hay un error.
   */
  it.each([
    ['una cadena', 'se rompió', 'string'],
    ['un número', 42, 'number'],
    ['null', null, 'object'],
    ['undefined', undefined, 'undefined'],
  ])('no revienta con %s', (_caso, thrown, expectedName) => {
    const report = describeError(thrown);

    expect(report.name).toBe(expectedName);
    expect(typeof report.message).toBe('string');
  });
});
