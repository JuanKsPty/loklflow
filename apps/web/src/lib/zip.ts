/**
 * Un escritor de ZIP mínimo, **sin compresión** (método «store»).
 *
 * Existe para que «descargar todos los códigos QR» entregue un archivo por mesa, con su nombre,
 * en vez de un único volcado que alguien tenga que recortar. Se escribe a mano en lugar de añadir
 * una dependencia porque lo que hace falta es la décima parte de una librería de ZIP: sin
 * compresión no hay deflate, y lo que queda son tres cabeceras y un CRC.
 *
 * No comprimir no es pereza: un QR en SVG son unos pocos kB de marcado que el navegador ya
 * transfiere comprimido, y el ahorro no compensa arrastrar deflate al bundle del panel.
 *
 * El formato está en la especificación APPNOTE de PKWARE. Todos los enteros son **little-endian**
 * y los desplazamientos del directorio central tienen que apuntar al byte exacto donde empieza
 * cada cabecera local: es el error clásico que produce un ZIP que unos programas abren y otros
 * dan por corrupto.
 */

/** Tabla del CRC-32 (polinomio 0xEDB88320), la que usan tanto ZIP como PNG. */
const CRC_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * La fecha en el formato de MS-DOS que heredó el ZIP: los segundos van en pasos de dos y el año
 * cuenta desde 1980, así que una fecha anterior no se puede representar y se recorta.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export interface ZipEntry {
  /** Ruta dentro del archivo. Puede llevar carpetas: `mesas/mesa-1.svg`. */
  name: string;
  content: string;
}

const encoder = new TextEncoder();

/**
 * Igual que `encoder.encode`, pero con el búfer concretado.
 *
 * `TextEncoder` declara `Uint8Array<ArrayBufferLike>`, que incluye `SharedArrayBuffer`, y `Blob`
 * solo acepta vistas sobre un `ArrayBuffer` normal. Copiar es lo honesto —y son unos pocos kB de
 * marcado por archivo— frente a un cast que taparía la diferencia.
 */
function utf8(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(encoder.encode(value));
}

/** Marca de que el nombre va en UTF-8, para que los acentos no salgan rotos al descomprimir. */
const UTF8_FLAG = 0x0800;
const STORED = 0;
const VERSION = 20;

export function createZip(entries: ZipEntry[], modifiedAt: Date = new Date()): Blob {
  const { time, date } = dosDateTime(modifiedAt);
  const files: Uint8Array<ArrayBuffer>[] = [];
  const directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = utf8(entry.name);
    const data = utf8(entry.content);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // firma de cabecera local
    lv.setUint16(4, VERSION, true);
    lv.setUint16(6, UTF8_FLAG, true);
    lv.setUint16(8, STORED, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // comprimido
    lv.setUint32(22, data.length, true); // sin comprimir; iguales porque no se comprime
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); // sin campo extra
    local.set(name, 30);
    files.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // firma del directorio central
    cv.setUint16(4, VERSION, true); // versión que lo creó
    cv.setUint16(6, VERSION, true); // versión necesaria para leerlo
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, STORED, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comentario
    cv.setUint16(34, 0, true); // número de disco
    cv.setUint16(36, 0, true); // atributos internos
    cv.setUint32(38, 0, true); // atributos externos
    cv.setUint32(42, offset, true); // dónde empieza su cabecera local
    central.set(name, 46);
    directory.push(central);

    offset += local.length + data.length;
  }

  const directorySize = directory.reduce((total, chunk) => total + chunk.length, 0);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // fin del directorio central
  ev.setUint16(4, 0, true); // disco actual
  ev.setUint16(6, 0, true); // disco donde empieza el directorio
  ev.setUint16(8, entries.length, true); // entradas en este disco
  ev.setUint16(10, entries.length, true); // entradas en total
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true); // el directorio empieza donde acaban los archivos
  ev.setUint16(20, 0, true); // sin comentario

  return new Blob([...files, ...directory, end], { type: 'application/zip' });
}

/**
 * Lanza la descarga de un blob con el nombre dado.
 *
 * El `revokeObjectURL` no es opcional: sin él el blob se queda en memoria mientras viva la
 * pestaña, y aquí puede ser el ZIP entero de un local con cincuenta mesas.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(href);
  }
}
