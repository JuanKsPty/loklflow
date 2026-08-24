import { PREPARATION_STATIONS, type PreparationStation } from '@loklflow/types';

/** Una celda vacía **no** significa «falso» ni «cero»: significa «no toques este campo». */
export const isBlank = (raw: string): boolean => raw.trim() === '';

/**
 * Plegado para **comparar vocabulario**: sin acentos, sin mayúsculas, sin espacios de más.
 *
 * Vale para casar una categoría —«Bebidas» y «bebidas» son la misma— pero **no** como clave de un
 * producto. Ver `productKey`.
 */
export function fold(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Clave de identidad de un producto. **Conserva los acentos**, y esa es toda la diferencia.
 *
 * Plegarlos sería peligroso aquí: `NFD` descompone la «ñ» en «n» + tilde, así que «Piña» y «Pina»
 * compartirían clave y una importación **sobrescribiría el producto equivocado en silencio**. La
 * insensibilidad a mayúsculas sí es segura: nadie tiene dos productos que solo se distingan por eso.
 */
export const productKey = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

const GRUPO_DE_MILLARES = /^\d{3}$/;

/**
 * Un número escrito por una persona con Excel en español, en inglés, o a mano.
 *
 * La regla, en orden:
 *  1. Se tira todo lo que no sea dígito, punto o coma. Eso se lleva `$`, `MXN`, el espacio duro
 *     (U+00A0) que Excel usa como separador de millares, y cualquier letra.
 *  2. Si aparecen **los dos** signos, el **último** es el decimal. `1.234,56` y `1,234.56` salen
 *     los dos 1234.56, sin saber de qué país viene el archivo.
 *  3. Si uno aparece **más de una vez**, es de millares: `1.234.567` → 1234567.
 *  4. Si aparece **uno solo, una vez**, es ambiguo, y lo desempata una afirmación sobre **precios**,
 *     no sobre texto: si le siguen exactamente tres dígitos es de millares; si no, es decimal.
 *
 * El punto 4 es lo único discutible, así que conviene defenderlo. `1.234` puede ser mil doscientos
 * treinta y cuatro o uno coma doscientos treinta y cuatro, y no hay nada en la celda que lo diga.
 * «Una marca sola siempre es decimal» convierte mil doscientos en un peso con veintitrés centavos;
 * «siempre es de millares» convierte 12.50 en mil doscientos cincuenta. Los dos errores son del
 * mismo tamaño, así que el empate no lo rompe la prudencia: lo rompe el dominio. **Un precio de
 * carta se escribe con dos decimales o con ninguno** —85, 12.50, 120.00—; nadie escribe uno con
 * exactamente tres. Y «tres dígitos tras la marca» es justo la forma que Excel emite para los
 * millares en las dos convenciones.
 *
 * Lo que la hace aceptable no es que acierte siempre, es que **se ve antes de escribir nada**: la
 * previsualización enseña el precio interpretado al lado del texto crudo de la celda.
 */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // El paréntesis es la notación contable de un negativo. Sin esto, `(12.50)` entraría como 12.50.
  const negativo = trimmed.startsWith('-') || /^\(.*\)$/.test(trimmed);
  const limpio = trimmed.replace(/[^\d.,]/g, '');
  if (limpio === '') return null;

  const puntos = (limpio.match(/\./g) ?? []).length;
  const comas = (limpio.match(/,/g) ?? []).length;

  let marca: '.' | ',' | null = null;
  if (puntos > 0 && comas > 0) {
    marca = limpio.lastIndexOf('.') > limpio.lastIndexOf(',') ? '.' : ',';
  } else if (puntos === 1 || comas === 1) {
    const m = puntos === 1 ? '.' : ',';
    marca = GRUPO_DE_MILLARES.test(limpio.slice(limpio.lastIndexOf(m) + 1)) ? null : m;
  } // más de uno del mismo signo → null (todos son de millares)

  const normalizado =
    marca === null
      ? limpio.replace(/[.,]/g, '')
      : limpio.slice(0, limpio.lastIndexOf(marca)).replace(/[.,]/g, '') +
        '.' +
        limpio.slice(limpio.lastIndexOf(marca) + 1);

  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) return null;
  return negativo ? -valor : valor;
}

/** El tope de `decimal(10,2)`. Pasarse es un `numeric field overflow`, o sea un 500. */
export const PRECIO_MAXIMO = 99_999_999.99;

export type PrecioParseado = { value: number; warning?: string } | { error: string };

/** Un precio: redondeado a dos decimales y dentro de lo que cabe en la columna. */
export function parsePrice(raw: string): PrecioParseado {
  const n = parseDecimal(raw);
  if (n === null) return { error: 'Falta el precio o no se entiende.' };
  if (n < 0) return { error: 'El precio no puede ser negativo.' };
  if (n > PRECIO_MAXIMO) return { error: 'El precio es demasiado grande.' };
  // `toFixed` y no `Math.round(n * 100) / 100`, que falla en 1.005. Y redondear importa: con tres
  // decimales el DTO responde 400 y **se pierde la tanda entera**.
  const value = Number(n.toFixed(2));
  return value === n ? { value } : { value, warning: `Se redondeó ${raw.trim()} a ${value}.` };
}

const VERDAD = new Set(['si', 's', 'true', 'verdadero', 'v', '1', 'x', 'activo', 'yes', 'y', 'ok']);
const FALSO = new Set(['no', 'n', 'false', 'falso', 'f', '0', 'inactivo']);

/**
 * `null` = no reconocido → error de fila. **Nunca se llama con la celda vacía**: un valor
 * desconocido que cayera a `false` escondería medio menú sin decir nada.
 *
 * `x` está en la lista de verdad porque una casilla marcada en Excel se exporta así.
 */
export function parseBoolean(raw: string): boolean | null {
  const v = fold(raw);
  if (VERDAD.has(v)) return true;
  if (FALSO.has(v)) return false;
  return null;
}

const ESTACIONES: Record<string, PreparationStation> = {
  cocina: 'kitchen',
  kitchen: 'kitchen',
  plancha: 'kitchen',
  'cocina caliente': 'kitchen',
  barra: 'bar',
  bar: 'bar',
  bebidas: 'bar',
  cafeteria: 'bar',
  inmediato: 'immediate',
  immediate: 'immediate',
  directo: 'immediate',
  'sin preparacion': 'immediate',
  vitrina: 'immediate',
  mostrador: 'immediate',
};

/** `null` = no reconocida. El mensaje de error enumera las tres, para que se pueda corregir. */
export function parseStation(raw: string): PreparationStation | null {
  const encontrada = ESTACIONES[fold(raw)];
  return encontrada && PREPARATION_STATIONS.includes(encontrada) ? encontrada : null;
}
