import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPrice, formatRelativeTime } from './format';

/**
 * `Intl` separa el símbolo de la cifra con un espacio **duro** (U+00A0) o estrecho (U+202F)
 * según el entorno. Se normalizan a uno normal para poder afirmar la cadena entera sin que el
 * test dependa de la versión de ICU del runner.
 */
const plano = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('formatPrice', () => {
  it('formatea en pesos con dos decimales', () => {
    expect(plano(formatPrice(1234.5))).toBe('$1,234.50');
  });

  it('siempre dos decimales, aunque sean cero', () => {
    expect(plano(formatPrice(10))).toBe('$10.00');
  });

  /**
   * `decimal` de Postgres llega al navegador como **cadena**. Es el mismo cuidado que en el
   * arqueo: sin la conversión, `formatPrice('19.99')` no fallaría, simplemente pintaría algo
   * distinto en un sitio donde el número es el precio que paga el cliente.
   */
  it('acepta la cadena que devuelve la API', () => {
    expect(plano(formatPrice('19.99'))).toBe('$19.99');
  });

  it('un valor negativo conserva el signo', () => {
    expect(plano(formatPrice(-5))).toMatch(/-\s?\$5\.00/);
  });

  describe('lo que no es un número', () => {
    // Un `NaN` en la pantalla de caja es peor que un cero: parece una avería y no se puede
    // sumar. Cae a cero **y se pinta**, que es lo que permite seguir cobrando.
    it.each(['', 'abc', NaN, Infinity])('«%s» se pinta como cero', (value) => {
      expect(plano(formatPrice(value as number | string))).toBe('$0.00');
    });
  });
});

describe('formatRelativeTime', () => {
  const desde = (ms: number) => new Date(Date.now() - ms).toISOString();

  afterEach(() => {
    vi.useRealTimers();
  });

  it('menos de un minuto es «ahora»', () => {
    expect(formatRelativeTime(desde(30_000))).toBe('ahora');
  });

  it('minutos', () => {
    expect(formatRelativeTime(desde(5 * 60_000))).toBe('hace 5 min');
  });

  it('horas', () => {
    expect(formatRelativeTime(desde(2 * 3_600_000))).toBe('hace 2 h');
  });

  it('días', () => {
    expect(formatRelativeTime(desde(3 * 86_400_000))).toBe('hace 3 d');
  });

  it('los cortes son exactos', () => {
    // 59 min sigue en minutos; 60 pasa a horas. Es lo que se ve en la comanda más vieja del KDS.
    expect(formatRelativeTime(desde(59 * 60_000))).toBe('hace 59 min');
    expect(formatRelativeTime(desde(60 * 60_000))).toBe('hace 1 h');
    expect(formatRelativeTime(desde(23 * 3_600_000))).toBe('hace 23 h');
    expect(formatRelativeTime(desde(24 * 3_600_000))).toBe('hace 1 d');
  });

  it('una fecha en el futuro no dice «hace -3 min»', () => {
    // Pasa de verdad: el reloj de una tablet adelantado unos segundos frente al del servidor.
    expect(formatRelativeTime(new Date(Date.now() + 30_000).toISOString())).toBe('ahora');
  });
});
