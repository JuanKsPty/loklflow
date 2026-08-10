/**
 * Qué PIN se acepta.
 *
 * El bloqueo por intentos fallidos y el límite de peticiones acotan cuántas combinaciones puede
 * probar alguien. Esto acota **cuáles** vale la pena probar: de las 10 000 de cuatro dígitos, un
 * puñado concentra la mayoría de los que la gente elige de verdad. Un atacante que solo pruebe
 * `1234`, `0000`, `1111` y `2580` acierta más a menudo de lo que sugiere la aritmética, y contra
 * eso el bloqueo no ayuda: no le hace falta insistir.
 *
 * Función pura con spec, siguiendo la convención del repo.
 */

/** El teclado numérico en filas, para detectar secuencias verticales como `2580`. */
const KEYPAD_PATTERNS = ['2580', '1470', '3690', '0852', '0741', '0963'];

/** Los que aparecen arriba en cualquier estudio de PINs reales. */
const COMMON = new Set([
  '1234',
  '1111',
  '0000',
  '1212',
  '7777',
  '1004',
  '2000',
  '4444',
  '2222',
  '6969',
  '9999',
  '3333',
  '5555',
  '6666',
  '1122',
  '1313',
  '8888',
  '4321',
  '2001',
  '1010',
  '123456',
  '654321',
  '111111',
  '000000',
  '121212',
]);

export type PinVerdict = { ok: true } | { ok: false; reason: string };

function isRepeated(pin: string): boolean {
  return new Set(pin).size === 1;
}

/** Ascendente o descendente de uno en uno: `1234`, `4321`, `0123`, `9876`. */
function isSequential(pin: string): boolean {
  const step = Number(pin[1]) - Number(pin[0]);
  if (step !== 1 && step !== -1) return false;
  for (let i = 2; i < pin.length; i++) {
    if (Number(pin[i]) - Number(pin[i - 1]) !== step) return false;
  }
  return true;
}

export function checkPin(pin: string): PinVerdict {
  if (!/^\d{4,6}$/.test(pin)) {
    return { ok: false, reason: 'El PIN debe tener entre 4 y 6 dígitos.' };
  }
  if (isRepeated(pin)) {
    return { ok: false, reason: 'El PIN no puede ser el mismo dígito repetido.' };
  }
  if (isSequential(pin)) {
    return { ok: false, reason: 'El PIN no puede ser una secuencia como 1234 o 4321.' };
  }
  if (KEYPAD_PATTERNS.includes(pin)) {
    return { ok: false, reason: 'El PIN no puede ser una línea recta del teclado.' };
  }
  if (COMMON.has(pin)) {
    return { ok: false, reason: 'Ese PIN es de los más usados. Elige otro.' };
  }
  return { ok: true };
}

/** Para los DTO, que solo necesitan el booleano. */
export function isAcceptablePin(pin: string): boolean {
  return checkPin(pin).ok;
}
