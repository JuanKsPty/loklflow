import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from './parse';

describe('detectDelimiter', () => {
  it('detecta la coma', () => {
    expect(detectDelimiter('nombre,precio\r\nTaco,10')).toBe(',');
  });

  it('detecta el punto y coma, que es lo que exporta el Excel en español', () => {
    expect(detectDelimiter('nombre;precio\r\nTaco;10')).toBe(';');
  });

  it('detecta el tabulador', () => {
    expect(detectDelimiter('nombre\tprecio\nTaco\t10')).toBe('\t');
  });

  it('con una sola columna cae en la coma', () => {
    expect(detectDelimiter('nombre\nTaco')).toBe(',');
  });

  it('no cuenta los separadores que van dentro de comillas', () => {
    expect(detectDelimiter('"nombre, largo";precio\r\nTaco;10')).toBe(';');
  });
});

describe('parseCsv', () => {
  it('quita el BOM de la primera cabecera', () => {
    // Sin esto, la primera columna sale «desconocida» con el resto del archivo perfecto.
    expect(parseCsv('﻿nombre,precio\r\nTaco,10').header[0]).toBe('nombre');
  });

  it('honra la directiva sep= de Excel y no la toma por cabecera', () => {
    const t = parseCsv('sep=;\r\nnombre;precio\r\nTaco;10');
    expect(t.delimiter).toBe(';');
    expect(t.header).toEqual(['nombre', 'precio']);
    expect(t.records).toHaveLength(1);
  });

  it('separa filas con CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4').records).toHaveLength(2);
  });

  it('separa filas con LF suelto', () => {
    expect(parseCsv('a,b\n1,2\n3,4').records).toHaveLength(2);
  });

  it('separa filas con CR suelto, del Excel viejo de Mac', () => {
    const t = parseCsv('a,b\r1,2');
    expect(t.records).toHaveLength(1);
    expect(t.records[0].cells).toEqual(['1', '2']);
  });

  it('un salto final no produce una fila vacía de más', () => {
    expect(parseCsv('a,b\r\n1,2\r\n').records).toHaveLength(1);
  });

  it('campo entrecomillado con el separador dentro', () => {
    expect(parseCsv('nombre,precio\r\n"Taco, doble",95').records[0].cells).toEqual([
      'Taco, doble',
      '95',
    ]);
  });

  it('comillas escapadas por duplicación', () => {
    expect(parseCsv('nombre\r\n"Taco ""especial"""').records[0].cells).toEqual([
      'Taco "especial"',
    ]);
  });

  it('salto de línea dentro de comillas no rompe la fila, y el CRLF se normaliza', () => {
    const t = parseCsv('nombre,desc\r\nTaco,"linea1\r\nlinea2"');
    expect(t.records).toHaveLength(1);
    // A LF: si no, la misma descripción escrita en Windows y en Mac se guarda distinta y al
    // reimportar el archivo la ve «cambiada» sin que nadie la haya tocado.
    expect(t.records[0].cells[1]).toBe('linea1\nlinea2');
  });

  it('campo entrecomillado vacío', () => {
    expect(parseCsv('a,b\r\n"",2').records[0].cells).toEqual(['', '2']);
  });

  it('una comilla en mitad de un campo sin comillas es literal', () => {
    expect(parseCsv('medida\r\n3" de alto').records[0].cells).toEqual(['3" de alto']);
  });

  it('una comilla sin cerrar al final se cierra sola y deja aviso de archivo', () => {
    const t = parseCsv('a\r\n"sin cerrar');
    expect(t.records[0].cells).toEqual(['sin cerrar']);
    expect(t.warnings.join(' ')).toMatch(/comilla sin cerrar/i);
  });

  it('las filas en blanco se saltan sin renumerar las siguientes', () => {
    // El número de línea tiene que casar con lo que se ve al abrir el archivo en Excel.
    const t = parseCsv('a,b\r\n1,2\r\n\r\n3,4');
    expect(t.records.map((r) => r.line)).toEqual([2, 4]);
  });

  it('una fila de puros separadores es una fila en blanco', () => {
    const t = parseCsv('a;b;c\r\n;;\r\n1;2;3');
    expect(t.records).toHaveLength(1);
    expect(t.records[0].line).toBe(3);
  });

  it('recorta la cabecera pero no las celdas', () => {
    // El recorte de una celda es una decisión por columna, no del formato.
    const t = parseCsv('  nombre  ,precio\r\n Taco ,10');
    expect(t.header[0]).toBe('nombre');
    expect(t.records[0].cells[0]).toBe(' Taco ');
  });
});
