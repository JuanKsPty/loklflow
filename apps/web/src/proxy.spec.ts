import { describe, expect, it } from 'vitest';
import { isProtected, isPublicPath } from './proxy';

/**
 * Qué rutas exigen sesión y cuáles no.
 *
 * Es la primera defensa de la aplicación —corre antes que cualquier layout— y decide, con dos
 * listas de cadenas, quién ve qué. Dos listas de cadenas es exactamente el tipo de cosa que alguien
 * edita con prisa un viernes.
 */
describe('protección de rutas', () => {
  describe('lo que exige sesión', () => {
    it.each([
      '/admin',
      '/admin/users',
      '/admin/inventario/ingredientes/abc',
      '/waiter',
      '/waiter/mesa/abc',
      '/kitchen',
      '/pos',
      '/pos/abc',
      '/orders',
    ])('%s', (path) => {
      expect(isProtected(path)).toBe(true);
    });
  });

  describe('lo que no', () => {
    it.each(['/', '/login', '/pin', '/pin/abc', '/recibo/abc', '/offline'])('%s', (path) => {
      expect(isProtected(path)).toBe(false);
    });
  });

  /**
   * El menú del cliente. Hoy pasaría igual porque no empieza por ningún prefijo protegido, así que
   * lo que se fija aquí es la **intención**: el día que alguien añada a `PROTECTED_PREFIXES` un
   * prefijo que empiece por `/m` —`/menu`, `/mesa`— esto se pone rojo en vez de mandar al cliente
   * que escanea un papel al formulario de acceso del personal.
   */
  describe('el menú público por QR', () => {
    it.each([
      '/m',
      '/m/11111111-1111-4111-8111-111111111111',
      '/m/11111111-1111-4111-8111-111111111111/pedido',
    ])('%s queda abierto', (path) => {
      expect(isPublicPath(path)).toBe(true);
      expect(isProtected(path)).toBe(false);
    });

    it('lo público gana sobre lo protegido', () => {
      // La salida temprana está antes de la comprobación de prefijos protegidos, y este caso es el
      // que lo demuestra sin depender de qué haya en la otra lista.
      expect(isProtected('/m/cualquier-cosa')).toBe(false);
    });

    /**
     * Un prefijo se compara por segmento y no por texto: sin eso, `/mesas-admin` quedaría abierta
     * por empezar por las mismas dos letras que `/m`.
     */
    it('no abre rutas que solo empiezan igual', () => {
      expect(isPublicPath('/menu')).toBe(false);
      expect(isPublicPath('/mesas')).toBe(false);
      expect(isPublicPath('/mi-cuenta')).toBe(false);
    });
  });
});
