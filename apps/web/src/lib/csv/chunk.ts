const encoder = new TextEncoder();

/**
 * Corta en tandas por **bytes**, no por filas ni por longitud de cadena.
 *
 * Dos razones, y las dos muerden:
 *
 * - El cuerpo de Express está en su límite por defecto de 100 kB. Con descripciones largas, 200
 *   filas serializadas pasan de 250 kB y la respuesta es un **413** cuyo cuerpo el cliente
 *   convierte en un mensaje inútil. El tope real tiene que salir del peor caso, no del promedio.
 * - `JSON.stringify(x).length` cuenta unidades UTF-16: la «ñ» son dos bytes y un emoji cuatro, así
 *   que un archivo en español pasaría el presupuesto y el cuerpo saldría un 15 % más grande de lo
 *   calculado.
 *
 * El presupuesto por defecto deja margen sobre los 100 kB para las claves envolventes, y el tope de
 * filas es el mismo que valida el DTO. Una fila que no cabe sale sola: descartarla en silencio
 * sería peor, y reintentarla en bucle, peor todavía.
 */
export function chunkByBytes<T>(rows: T[], maxBytes = 60_000, maxRows = 200): T[][] {
  const tandas: T[][] = [];
  let actual: T[] = [];
  let bytes = 0;

  for (const row of rows) {
    const peso = encoder.encode(JSON.stringify(row)).length + 1; // +1 por la coma
    if (actual.length > 0 && (bytes + peso > maxBytes || actual.length >= maxRows)) {
      tandas.push(actual);
      actual = [];
      bytes = 0;
    }
    actual.push(row);
    bytes += peso;
  }

  if (actual.length > 0) tandas.push(actual);
  return tandas;
}
