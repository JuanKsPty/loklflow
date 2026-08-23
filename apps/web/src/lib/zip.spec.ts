import { describe, expect, it } from 'vitest';
import { createZip, crc32 } from './zip';

/**
 * El ZIP se escribe a mano, así que lo que se comprueba aquí es lo que un descompresor comprueba:
 * que el CRC de cada archivo sea el de verdad y que los desplazamientos del directorio central
 * apunten al byte donde empieza cada cabecera local. Los dos fallos producen un archivo que unos
 * programas abren y otros dan por corrupto, que es la peor forma de romperse.
 */

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

async function bytesOf(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buffer), view: new DataView(buffer) };
}

/** Localiza el fin del directorio central, que es el último registro del archivo. */
function endRecord(view: DataView) {
  const offset = view.byteLength - 22; // sin comentario, el registro final mide exactamente 22
  expect(view.getUint32(offset, true)).toBe(END);
  return {
    entries: view.getUint16(offset + 10, true),
    directorySize: view.getUint32(offset + 12, true),
    directoryOffset: view.getUint32(offset + 16, true),
  };
}

describe('crc32', () => {
  it('coincide con el vector de referencia de la especificación', () => {
    // "123456789" -> 0xCBF43926 es el vector con el que se verifica CRC-32 en todas partes.
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('el de la cadena vacía es cero', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('createZip', () => {
  const entries = [
    { name: 'mesa-1-qr.svg', content: '<svg><rect /></svg>' },
    { name: 'mesa-2-qr.svg', content: '<svg><circle /></svg>' },
  ];
  const fecha = new Date(2026, 7, 10, 12, 34, 56);

  it('cada entrada del directorio apunta a una cabecera local de verdad', async () => {
    const { view } = await bytesOf(createZip(entries, fecha));
    const { entries: total, directoryOffset } = endRecord(view);

    expect(total).toBe(2);

    let cursor = directoryOffset;
    for (let i = 0; i < total; i++) {
      expect(view.getUint32(cursor, true)).toBe(CENTRAL);
      const nameLength = view.getUint16(cursor + 28, true);
      const localOffset = view.getUint32(cursor + 42, true);

      // Lo que de verdad importa: ahí tiene que empezar una cabecera local.
      expect(view.getUint32(localOffset, true)).toBe(LOCAL);
      cursor += 46 + nameLength;
    }
  });

  it('el CRC y el tamaño del directorio coinciden con los de la cabecera local', async () => {
    const { view } = await bytesOf(createZip(entries, fecha));
    const { directoryOffset } = endRecord(view);

    const localOffset = view.getUint32(directoryOffset + 42, true);
    expect(view.getUint32(directoryOffset + 16, true)).toBe(view.getUint32(localOffset + 14, true));
    expect(view.getUint32(directoryOffset + 20, true)).toBe(view.getUint32(localOffset + 18, true));

    // Sin comprimir, los dos tamaños son el del contenido.
    const contenido = new TextEncoder().encode(entries[0].content).length;
    expect(view.getUint32(localOffset + 18, true)).toBe(contenido);
    expect(view.getUint32(localOffset + 22, true)).toBe(contenido);
    expect(view.getUint32(localOffset + 14, true)).toBe(
      crc32(new TextEncoder().encode(entries[0].content)),
    );
  });

  it('el contenido de cada archivo queda tal cual, sin comprimir', async () => {
    const { bytes, view } = await bytesOf(createZip(entries, fecha));
    const nameLength = view.getUint16(26, true);
    const size = view.getUint32(18, true);
    const start = 30 + nameLength;

    expect(new TextDecoder().decode(bytes.slice(start, start + size))).toBe(entries[0].content);
  });

  it('marca los nombres como UTF-8 para que un acento no se descomprima roto', async () => {
    const { bytes, view } = await bytesOf(
      createZip([{ name: 'mesa-ñ.svg', content: '<svg />' }], fecha),
    );

    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
    const nameLength = view.getUint16(26, true);
    expect(new TextDecoder().decode(bytes.slice(30, 30 + nameLength))).toBe('mesa-ñ.svg');
  });

  it('un archivo sin entradas sigue siendo un ZIP válido y vacío', async () => {
    const { view } = await bytesOf(createZip([], fecha));
    const { entries: total, directorySize, directoryOffset } = endRecord(view);

    expect(total).toBe(0);
    expect(directorySize).toBe(0);
    expect(directoryOffset).toBe(0);
    expect(view.byteLength).toBe(22);
  });
});
