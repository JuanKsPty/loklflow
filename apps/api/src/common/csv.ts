/**
 * Serialización a CSV sin dependencias.
 *
 * Reglas de RFC 4180 que importan de verdad: se entrecomilla si el valor contiene el
 * separador, una comilla o un salto de línea, y las comillas internas se duplican. Sin
 * esto, un nombre con coma parte la fila y desplaza todas las columnas.
 */

const needsQuoting = (s: string) => /[",\r\n]/.test(s);

function toCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  return needsQuoting(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  key: keyof T & string;
  header: string;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const head = columns.map((c) => toCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => toCell(row[c.key])).join(','));
  // CRLF: es lo que espera Excel, y el BOM se añade al servir el archivo.
  return [head, ...body].join('\r\n');
}

/**
 * Excel en Windows interpreta un CSV sin BOM como Latin-1 y destroza los acentos.
 * El BOM UTF-8 lo evita y el resto de las herramientas lo ignoran.
 */
export const UTF8_BOM = '﻿';
