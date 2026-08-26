/**
 * La calculadora de cajas de la pantalla de existencias.
 *
 * La barra se compra por cartón —seis cajas de veinticuatro— y se cuenta por botella. Esto es
 * **solo** lo que evita multiplicar de cabeza delante del estante: rellena el campo, y el campo
 * sigue siendo editable. Nada de esto se guarda en el servidor; lo que viaja es el total.
 */

const STORAGE_PREFIX = 'loklflow:packs:';

/**
 * El total en unidades, o `null` si falta algo o no son números.
 *
 * Se acepta la coma decimal igual que en el campo grande: el teclado numérico de un móvil en
 * español la ofrece antes que el punto, y `Number('1,5')` es `NaN`.
 */
export function packTotal(cajas: string, porCaja: string): number | null {
  const n = toNumber(cajas);
  const m = toNumber(porCaja);
  if (n === null || m === null) return null;
  if (n <= 0 || m <= 0) return null;
  return Number((n * m).toFixed(3));
}

/**
 * «6 cajas × 24», o `undefined` si el total ya no es el de las cajas.
 *
 * Lo segundo es la razón de que esta función exista. El campo grande se puede corregir a mano
 * después de usar la calculadora —llegaron seis cajas y tres sueltas—, y en cuanto se corrige, la
 * frase deja de ser cierta. El libro mayor lo lee una persona seis meses después: prefiere no
 * decir nada a decir «6 cajas × 24» al lado de un 147.
 */
export function packNote(cajas: string, porCaja: string, total: number): string | undefined {
  const esperado = packTotal(cajas, porCaja);
  if (esperado === null || esperado !== total) return undefined;
  const n = toNumber(cajas) as number;
  return `${n} ${n === 1 ? 'caja' : 'cajas'} × ${toNumber(porCaja) as number}`;
}

/**
 * Cuántas unidades por caja se usaron la última vez con este producto, si se usaron.
 *
 * Es lo que hace que la calculadora salga desplegada en las cervezas y plegada en todo lo demás
 * sin una pantalla de configuración ni una columna en la base: sale de usarla. Por dispositivo,
 * como el resto de preferencias de pantalla del panel (ver `use-qr-base-url.ts`).
 *
 * Todo va en `try/catch`: en una ventana privada `localStorage` **lanza** al leerlo, y quedarse
 * sin poder registrar existencias por una preferencia de comodidad sería absurdo.
 */
export function cajasRecordadas(productId: string): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + productId);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function recordarCajas(productId: string, porCaja: number): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + productId, String(porCaja));
  } catch {
    // Sin memoria se sigue pudiendo trabajar: solo hace falta un toque más la próxima vez.
  }
}

export function olvidarCajas(productId: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + productId);
  } catch {
    // Ídem.
  }
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
