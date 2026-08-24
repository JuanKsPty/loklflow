export type Delimiter = ',' | ';' | '\t';

const CANDIDATES: Delimiter[] = [',', ';', '\t'];

export interface CsvRecord {
  /** Número de registro **en el archivo**. 1 es la cabecera. Nunca se renumera. */
  line: number;
  cells: string[];
}

export interface CsvTable {
  delimiter: Delimiter;
  header: string[];
  records: CsvRecord[];
  /** Problemas del archivo entero, no de una fila. */
  warnings: string[];
}

/**
 * Qué separa las columnas.
 *
 * Se cuentan las ocurrencias **fuera de comillas** y **solo en el primer registro**: la cabecera no
 * tiene texto libre y lleva exactamente los mismos separadores que cualquier fila bien formada, así
 * que es la muestra más limpia del archivo. Empate → coma.
 */
export function detectDelimiter(text: string): Delimiter {
  const counts = new Map<Delimiter, number>(CANDIDATES.map((c) => [c, 0]));
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else quoted = false;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === '\n' || ch === '\r') break; // fin del primer registro
    const hit = CANDIDATES.find((c) => c === ch);
    if (hit) counts.set(hit, (counts.get(hit) ?? 0) + 1);
  }
  let best: Delimiter = ',';
  for (const c of CANDIDATES) {
    if ((counts.get(c) ?? 0) > (counts.get(best) ?? 0)) best = c;
  }
  return best;
}

/**
 * Un CSV, leído como lo escribe una hoja de cálculo de verdad.
 *
 * Escrito a mano y sin dependencias, igual que `lib/zip.ts` y `public/sw.js`. Lo que tiene que
 * sobrevivir está en su spec, caso por caso.
 */
export function parseCsv(input: string): CsvTable {
  // El BOM se quita otra vez aquí aunque `decodeSpreadsheet` ya lo haya consumido: el parser tiene
  // que ser correcto lo llame quien lo llame, y un BOM (U+FEFF) pegado a «nombre» convierte la primera
  // columna en desconocida con el resto del archivo perfecto, que es lo desconcertante.
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const warnings: string[] = [];

  // `sep=;` en la primera línea es una directiva de Microsoft: da el separador **gratis y sin
  // adivinar**, y si no se saltara se convertiría en una cabecera falsa. Los archivos que la traen
  // llegan solos: los genera Excel y los reexporta Sheets.
  const sep = /^sep=(.)\r?\n/.exec(text);
  let delimiter: Delimiter;
  if (sep && CANDIDATES.includes(sep[1] as Delimiter)) {
    delimiter = sep[1] as Delimiter;
    text = text.slice(sep[0].length);
  } else {
    delimiter = detectDelimiter(text);
  }

  const rows: string[][] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let opened = false; // ¿este campo empezó con comilla?
  let i = 0;

  const endField = () => {
    cells.push(field);
    field = '';
    opened = false;
  };
  const endRecord = () => {
    endField();
    rows.push(cells);
    cells = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // comilla escapada por duplicación
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      // CRLF dentro de comillas se guarda como LF. Si no, la misma descripción escrita en Windows
      // y en Mac se guarda distinta byte a byte, y al reimportar el archivo la ve «cambiada» sin
      // que nadie la haya tocado.
      if (ch === '\r' && text[i + 1] === '\n') {
        field += '\n';
        i += 2;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    // Solo abre comillas al principio del campo: `3" de alto` es literal, como manda el RFC.
    if (ch === '"' && field === '' && !opened) {
      quoted = true;
      opened = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i++;
      continue;
    }
    if (ch === '\r') {
      // CRLF y CR suelto: el segundo es Excel de Mac clásico, y sigue apareciendo.
      endRecord();
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') {
      endRecord();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (quoted) {
    // No se lanza: el usuario prefiere ver 199 filas y un aviso a ver «archivo inválido».
    warnings.push('El archivo termina con una comilla sin cerrar; se leyó hasta el final.');
  }
  // Un archivo que acaba en salto de línea no debe producir un registro vacío de más.
  if (field !== '' || cells.length > 0) endRecord();

  const header = (rows[0] ?? []).map((h) => h.trim());
  const records: CsvRecord[] = [];
  rows.slice(1).forEach((row, index) => {
    // Las filas en blanco se saltan **sin renumerar**: el número de línea es el del archivo, que
    // es el que el usuario ve al abrirlo. Excel exporta `;;;` de sobra continuamente.
    if (row.every((c) => c.trim() === '')) return;
    records.push({ line: index + 2, cells: row });
  });

  return { delimiter, header, records, warnings };
}
