import { describe, expect, it } from 'vitest';
import {
  fold,
  isBlank,
  parseBoolean,
  parseDecimal,
  parsePrice,
  parseStation,
  productKey,
} from './coerce';

describe('parseDecimal', () => {
  it.each([
    ['1234.56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['$ 12.50', 12.5],
    ['12,50 MXN', 12.5],
    ['1 234,56', 1234.56],
    ['1 234,56', 1234.56], // espacio duro: es lo que mete Excel como separador de millares
    ['1.234.567', 1234567],
    ['1,234,567', 1234567],
    ['0', 0],
    ['-5', -5],
    ['12.', 12],
    ['.5', 0.5],
  ])('%s → %s', (entrada, esperado) => {
    expect(parseDecimal(entrada)).toBe(esperado);
  });

  it('tres dígitos tras una marca única son millares', () => {
    // Un precio de carta lleva dos decimales o ninguno; «.234» es la forma de los millares.
    expect(parseDecimal('1.234')).toBe(1234);
    expect(parseDecimal('85.000')).toBe(85000);
  });

  it('y eso incluye el caso incómodo: 12.567 son doce mil quinientos sesenta y siete', () => {
    // Es la consecuencia deliberada de la regla, y conviene tenerla clavada: un precio de carta
    // lleva dos decimales o ninguno, así que tres dígitos tras la marca solo pueden ser millares.
    // Quien escriba «12.567» queriendo doce con medio lo ve interpretado en la previsualización,
    // al lado del texto crudo de su celda, antes de que se escriba nada.
    expect(parseDecimal('12.567')).toBe(12567);
  });

  it('dos dígitos tras una marca única son decimales', () => {
    expect(parseDecimal('12.50')).toBe(12.5);
    expect(parseDecimal('1,5')).toBe(1.5);
  });

  it('el paréntesis contable es un negativo, no doce cincuenta', () => {
    expect(parseDecimal('(12.50)')).toBe(-12.5);
  });

  it('el cero es un valor, no un vacío', () => {
    expect(parseDecimal('0')).toBe(0);
    expect(parseDecimal('0')).not.toBeNull();
  });

  it.each([['', null], ['   ', null], ['gratis', null], ['.', null]])(
    '%s no es un número',
    (entrada, esperado) => {
      expect(parseDecimal(entrada as string)).toBe(esperado);
    },
  );
});

describe('parsePrice', () => {
  it('redondea a dos decimales y lo dice', () => {
    // Con más de dos decimales el DTO responde 400 y se pierde la tanda entera.
    const r = parsePrice('12,5678');
    expect(r).toMatchObject({ value: 12.57 });
    expect('warning' in r && r.warning).toBeTruthy();
  });

  it('un precio limpio no deja aviso', () => {
    expect(parsePrice('95')).toEqual({ value: 95 });
  });

  it('rechaza un negativo', () => {
    expect(parsePrice('-5')).toMatchObject({ error: expect.stringMatching(/negativo/i) });
  });

  it('rechaza un vacío', () => {
    expect(parsePrice('')).toMatchObject({ error: expect.stringMatching(/precio/i) });
  });

  it('rechaza lo que no cabe en decimal(10,2)', () => {
    // Sin esto es un `numeric field overflow` de Postgres, o sea un 500.
    expect(parsePrice('9999999999')).toMatchObject({ error: expect.stringMatching(/grande/i) });
  });
});

describe('parseBoolean', () => {
  it.each([['sí', true], ['si', true], ['SÍ', true], ['S', true], ['1', true], ['ok', true]])(
    '%s es verdadero',
    (e, v) => expect(parseBoolean(e as string)).toBe(v),
  );

  it.each([['no', false], ['NO ', false], ['false', false], ['0', false], ['inactivo', false]])(
    '%s es falso',
    (e, v) => expect(parseBoolean(e as string)).toBe(v),
  );

  it('una casilla marcada en Excel es una x', () => {
    expect(parseBoolean('x')).toBe(true);
  });

  it('un valor desconocido no cae a falso en silencio', () => {
    // Caer a `false` escondería medio menú sin decir nada.
    expect(parseBoolean('tal vez')).toBeNull();
  });

  it('la celda vacía no llega hasta aquí: se corta antes', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('  ')).toBe(true);
    expect(isBlank('no')).toBe(false);
  });
});

describe('parseStation', () => {
  it.each([
    ['cocina', 'kitchen'],
    ['Cocina', 'kitchen'],
    ['COCINA', 'kitchen'],
    ['plancha', 'kitchen'],
    ['barra', 'bar'],
    ['Bebidas', 'bar'],
    ['inmediato', 'immediate'],
    ['vitrina', 'immediate'],
  ])('%s → %s', (e, v) => expect(parseStation(e)).toBe(v));

  it('una estación desconocida no se adivina', () => {
    expect(parseStation('freidora')).toBeNull();
  });
});

describe('claves', () => {
  it('fold pliega acentos, mayúsculas y espacios, para comparar vocabulario', () => {
    expect(fold('  Postres  ')).toBe('postres');
    expect(fold('BEBIDAS FRÍAS')).toBe('bebidas frias');
    expect(fold('Café  con   leche')).toBe('cafe con leche');
  });

  it('la clave de producto conserva la eñe: «Piña» y «Pina» no son el mismo producto', () => {
    // Plegar acentos aquí haría que una importación sobrescribiera el producto equivocado.
    expect(productKey('PIÑA')).not.toBe(productKey('Pina'));
    expect(productKey('PIÑA')).toBe(productKey('piña'));
  });

  it('pero sí normaliza mayúsculas y espacios de más', () => {
    expect(productKey('  Taco   al pastor ')).toBe('taco al pastor');
    expect(productKey('TACO AL PASTOR')).toBe('taco al pastor');
  });
});
