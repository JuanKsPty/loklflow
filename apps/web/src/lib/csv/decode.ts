export type SpreadsheetEncoding = 'utf-8' | 'windows-1252';

/**
 * De bytes a texto, adivinando la codificación.
 *
 * **`file.text()` no vale**, y es la trampa que más caro sale de todo esto: `Blob.text()` decodifica
 * siempre como UTF-8 y **sustituye** los bytes inválidos por `U+FFFD`, sin lanzar nada. Un CSV
 * guardado por el Excel en español —que es Windows-1252— entra con la ñ y los acentos rotos y
 * **sin un solo error**, y el destrozo llega hasta la base de datos.
 *
 * El olfateo es el clásico y es fiable por una razón concreta: las secuencias multibyte de UTF-8
 * son un código con redundancia, y un texto Latin-1 real casi nunca las forma por azar. Así que
 * «decodifica como UTF-8 estricto; si revienta, es Windows-1252» acierta salvo con textos
 * construidos a propósito. La red de seguridad está en `products.ts`, que marca como error de fila
 * cualquier celda con `U+FFFD`: un archivo mal olfateado no puede importarse en silencio.
 */
export function decodeSpreadsheet(bytes: Uint8Array): {
  text: string;
  encoding: SpreadsheetEncoding;
} {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    // Con BOM no hay nada que adivinar. `TextDecoder` lo consume él solo: `ignoreBOM: false` es el
    // valor por defecto y significa «quítalo», que se lee justo al revés de lo que hace.
    return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
  }
  try {
    // `fatal: true` es toda la pieza: sin él no hay excepción que capturar, solo U+FFFD.
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}
