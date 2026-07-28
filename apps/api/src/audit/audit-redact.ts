/**
 * Redacción de datos sensibles antes de persistirlos en audit_logs.
 *
 * Es imprescindible: UsersService devuelve la entidad User con `password` y `pin` ya
 * hasheados, y los DTO de login llevan la contraseña en claro. Volcar eso crudo en
 * old_value/new_value filtraría credenciales a una tabla que el rol Gerente puede leer.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'newpassword',
  'currentpassword',
  'pin',
  'pinhash',
  'pin_hash',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
]);

export const REDACTED = '[redacted]';

const isSensitive = (key: string) => SENSITIVE_KEYS.has(key.toLowerCase());

/** Solo objetos planos: las instancias de clase (Date, entidades) se tratan como hoja. */
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  (Object.getPrototypeOf(v) === Object.prototype ||
    Object.getPrototypeOf(v) === null);

function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  // Tope de profundidad: un objeto muy anidado no debe poder colgar la escritura del log.
  if (depth > 8) return REDACTED;

  if (Array.isArray(value)) {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    return value.map((v) => redactValue(v, seen, depth + 1));
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitive(k) ? REDACTED : redactValue(v, seen, depth + 1);
    }
    return out;
  }

  return value;
}

/**
 * Devuelve una copia del objeto con las claves sensibles sustituidas por `[redacted]`,
 * a cualquier profundidad y también dentro de arrays. No muta la entrada.
 * Devuelve undefined si no hay nada que registrar, para dejar la columna en NULL.
 */
export function redact(
  input: unknown,
): Record<string, unknown> | undefined {
  if (input === null || input === undefined) return undefined;
  // Las entidades de TypeORM no son objetos planos; se pasan por un ciclo de JSON para
  // quedarnos con sus datos y descartar métodos y referencias internas.
  const plain: unknown = isPlainObject(input)
    ? input
    : (JSON.parse(JSON.stringify(input)) as unknown);
  if (!isPlainObject(plain)) return undefined;
  const result = redactValue(plain, new WeakSet(), 0);
  return isPlainObject(result) ? result : undefined;
}

/**
 * Selecciona solo un subconjunto de campos y los redacta. Útil para el snapshot de
 * `oldValue`, donde queremos guardar los campos que el DTO puede cambiar y nada más.
 */
export function redactPick<T extends object>(
  source: T,
  keys: readonly (keyof T)[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    const k = String(key);
    picked[k] = isSensitive(k) ? REDACTED : source[key];
  }
  return redact(picked) ?? {};
}
