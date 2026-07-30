import { toCsv, type CsvColumn } from './csv';

interface Row extends Record<string, unknown> {
  name: string;
  amount: number | null;
}

const cols: CsvColumn<Row>[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'amount', header: 'Importe' },
];

describe('toCsv', () => {
  it('escribe la cabecera aunque no haya filas', () => {
    expect(toCsv([], cols)).toBe('Nombre,Importe');
  });

  it('separa las filas con CRLF, que es lo que espera Excel', () => {
    const csv = toCsv([{ name: 'Taco', amount: 10 }], cols);
    expect(csv).toBe('Nombre,Importe\r\nTaco,10');
  });

  it('entrecomilla los valores que contienen el separador', () => {
    // Sin esto la coma partiría la fila y desplazaría todas las columnas.
    const csv = toCsv([{ name: 'Taco, doble', amount: 10 }], cols);
    expect(csv).toContain('"Taco, doble",10');
  });

  it('duplica las comillas internas', () => {
    const csv = toCsv([{ name: 'Taco "especial"', amount: 1 }], cols);
    expect(csv).toContain('"Taco ""especial""",1');
  });

  it('entrecomilla los saltos de línea en lugar de romper la fila', () => {
    const csv = toCsv([{ name: 'linea1\nlinea2', amount: 1 }], cols);
    expect(csv).toBe('Nombre,Importe\r\n"linea1\nlinea2",1');
    // Una fila de datos: la cabecera más una, separadas por CRLF.
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('deja vacías las celdas null y undefined', () => {
    const csv = toCsv([{ name: 'x', amount: null }], cols);
    expect(csv).toContain('x,');
    const csv2 = toCsv([{ name: 'x' } as Row], cols);
    expect(csv2).toContain('x,');
  });

  it('serializa las fechas en ISO', () => {
    const d = new Date('2026-03-04T05:06:07.000Z');
    const csv = toCsv([{ fecha: d } as unknown as Row], [
      { key: 'fecha' as keyof Row & string, header: 'Fecha' },
    ]);
    expect(csv).toContain('2026-03-04T05:06:07.000Z');
  });

  it('respeta el orden de las columnas, no el de las claves del objeto', () => {
    const csv = toCsv([{ amount: 9, name: 'z' }], cols);
    expect(csv).toBe('Nombre,Importe\r\nz,9');
  });

  it('ignora las claves que no están en las columnas', () => {
    const csv = toCsv([{ name: 'a', amount: 1, secreto: 'no exportar' } as Row], cols);
    expect(csv).not.toContain('no exportar');
  });

  it('acepta el 0 como valor y no lo confunde con vacío', () => {
    expect(toCsv([{ name: 'x', amount: 0 }], cols)).toContain('x,0');
  });
});
