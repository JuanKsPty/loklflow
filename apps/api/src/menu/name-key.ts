/**
 * Normalización de nombres para la importación de catálogo.
 *
 * **Duplicado a propósito** respecto a `apps/web/src/lib/csv/coerce.ts`, igual que
 * `preparation-station.constants.ts` lo está respecto a `@loklflow/types`: el backend se mantiene
 * autocontenido y no importa el paquete compartido en compilación. Los dos specs comparten los
 * mismos vectores para que la duplicación no derive.
 */

/** Para comparar **vocabulario** —categorías—: sin acentos, sin mayúsculas, sin espacios de más. */
export function fold(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Clave de identidad de un **producto**. Conserva los acentos.
 *
 * Plegarlos aquí sería peligroso: `NFD` descompone la «ñ», así que «Piña» y «Pina» compartirían
 * clave y una importación sobrescribiría el producto equivocado en silencio. La insensibilidad a
 * mayúsculas sí es segura.
 */
export const productKey = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
