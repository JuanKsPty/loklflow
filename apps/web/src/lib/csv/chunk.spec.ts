import { describe, expect, it } from 'vitest';
import { chunkByBytes } from './chunk';

const pesar = (t: unknown[]) => new TextEncoder().encode(JSON.stringify(t)).length;

describe('chunkByBytes', () => {
  it('corta por bytes, no por caracteres: la ñ ocupa dos', () => {
    // `JSON.stringify(x).length` cuenta unidades UTF-16, así que un archivo en español pasaría el
    // presupuesto y el cuerpo saldría un 15 % más grande de lo calculado — y Express responde 413.
    const filas = Array.from({ length: 40 }, (_, i) => ({ nombre: 'ñ'.repeat(50), i }));
    const tandas = chunkByBytes(filas, 1000, 200);
    for (const t of tandas) expect(pesar(t)).toBeLessThanOrEqual(1000 + 200);
    expect(tandas.flat()).toHaveLength(40);
  });

  it('respeta el tope de filas aunque quepan más bytes', () => {
    const filas = Array.from({ length: 500 }, (_, i) => ({ i }));
    const tandas = chunkByBytes(filas, 10_000_000, 200);
    expect(Math.max(...tandas.map((t) => t.length))).toBeLessThanOrEqual(200);
    expect(tandas.flat()).toHaveLength(500);
  });

  it('una sola fila que no cabe sale sola, no se descarta ni entra en bucle', () => {
    const filas = [{ enorme: 'x'.repeat(5000) }, { pequeña: 1 }];
    const tandas = chunkByBytes(filas, 100, 200);
    expect(tandas).toHaveLength(2);
    expect(tandas.flat()).toHaveLength(2);
  });

  it('sin filas no produce tandas', () => {
    expect(chunkByBytes([], 100, 10)).toEqual([]);
  });
});
