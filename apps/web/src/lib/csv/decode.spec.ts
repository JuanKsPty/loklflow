import { describe, expect, it } from 'vitest';
import { decodeSpreadsheet } from './decode';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('decodeSpreadsheet', () => {
  it('la decodificación de Windows-1252 está disponible en este runtime', () => {
    // Necesita ICU completo. Los binarios oficiales de Node lo traen y la imagen de CI también,
    // pero un runtime con `small-icu` haría fallar el resto de esta suite con un error críptico.
    expect(() => new TextDecoder('windows-1252')).not.toThrow();
  });

  it('un archivo con BOM se lee como UTF-8 y el BOM no llega al texto', () => {
    // EF BB BF + "nombre"
    const r = decodeSpreadsheet(bytes(0xef, 0xbb, 0xbf, 0x6e, 0x6f, 0x6d, 0x62, 0x72, 0x65));
    expect(r).toEqual({ text: 'nombre', encoding: 'utf-8' });
  });

  it('un UTF-8 sin BOM se reconoce por sus secuencias válidas', () => {
    // "Piña" en UTF-8: la ñ son dos bytes (C3 B1).
    expect(decodeSpreadsheet(bytes(0x50, 0x69, 0xc3, 0xb1, 0x61))).toEqual({
      text: 'Piña',
      encoding: 'utf-8',
    });
  });

  it('un Windows-1252 se reconoce porque no es UTF-8 válido', () => {
    // "Piña" en Windows-1252: la ñ es un solo byte (F1), que en UTF-8 no forma nada.
    const r = decodeSpreadsheet(bytes(0x50, 0x69, 0xf1, 0x61));
    expect(r).toEqual({ text: 'Piña', encoding: 'windows-1252' });
    // Lo que `file.text()` habría devuelto, y que llegaría hasta la base sin un solo error.
    expect(r.text).not.toContain('�');
  });

  it('un archivo ASCII puro sale igual por los dos caminos', () => {
    expect(decodeSpreadsheet(bytes(0x54, 0x61, 0x63, 0x6f))).toEqual({
      text: 'Taco',
      encoding: 'utf-8',
    });
  });
});
