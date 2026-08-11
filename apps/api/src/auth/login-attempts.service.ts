import { Injectable, Optional } from '@nestjs/common';

/**
 * Bloqueo temporal tras varios intentos fallidos.
 *
 * El límite de peticiones de `AuthThrottlerGuard` acota la **velocidad**; esto acota el **total**.
 * Sin él, diez intentos por minuto contra un PIN de cuatro dígitos recorren las 10 000
 * combinaciones en unas 17 horas, y una tablet olvidada en la barra tiene toda la noche.
 *
 * **En memoria y no en una columna.** Una columna significaría una escritura por cada intento
 * fallido en la ruta más caliente y expuesta de la aplicación, más una migración. Lo único que se
 * pierde al reiniciar el proceso es el bloqueo en curso, y eso no lo puede provocar quien está
 * probando: en un local el servidor se reinicia cuando se despliega, no cuando alguien quiere.
 *
 * El reloj se inyecta para poder probar el desbloqueo sin esperar.
 */

/** Fallos consecutivos antes del primer bloqueo. */
const THRESHOLD = 5;

/** Primer bloqueo, que se dobla en cada tanda posterior. */
const BASE_LOCK_MS = 60_000;

/** Techo del bloqueo. Más allá de esto solo castiga a quien se equivocó de verdad. */
const MAX_LOCK_MS = 15 * 60_000;

/**
 * Tope de claves vivas.
 *
 * **No es decoración**: la clave lleva datos que vienen de fuera, así que sin tope este mapa es un
 * agotamiento de memoria de una línea. Es la misma lección que ya está escrita en `LogThrottle`.
 */
const MAX_KEYS = 5_000;

interface Attempt {
  failures: number;
  lockedUntil: number;
  /** Última actividad, para saber a quién expulsar cuando el mapa se llena. */
  touchedAt: number;
}

@Injectable()
export class LoginAttemptsService {
  private readonly attempts = new Map<string, Attempt>();

  /**
   * El reloj se inyecta para poder probar el desbloqueo sin esperar un minuto de verdad.
   *
   * `@Optional()` porque Nest ve un parámetro de constructor e intenta resolverlo: sin él, el
   * contenedor falla al arrancar con «can't resolve dependencies of LoginAttemptsService». Con el
   * decorador pasa `undefined`, y ahí es donde entra el valor por defecto de TypeScript.
   */
  constructor(@Optional() private readonly now: () => number = () => Date.now()) {}

  /** Si esta clave está bloqueada ahora mismo. */
  isLocked(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;
    if (entry.lockedUntil > this.now()) return true;
    // El bloqueo caducó. Se conservan los fallos para que la siguiente tanda doble el castigo.
    return false;
  }

  /**
   * Registra un fallo. Devuelve `true` si esto acaba de bloquear la cuenta.
   *
   * El bloqueo se dobla con cada tanda de `THRESHOLD` fallos: un minuto, dos, cuatro… hasta quince.
   * Alguien que se equivoca dos veces no nota nada; alguien que prueba mil, sí.
   */
  registerFailure(key: string): boolean {
    const now = this.now();
    const entry = this.attempts.get(key) ?? { failures: 0, lockedUntil: 0, touchedAt: now };

    entry.failures += 1;
    entry.touchedAt = now;

    const rounds = Math.floor(entry.failures / THRESHOLD);
    const justLocked = entry.failures % THRESHOLD === 0 && rounds > 0;
    if (justLocked) {
      entry.lockedUntil = now + Math.min(BASE_LOCK_MS * 2 ** (rounds - 1), MAX_LOCK_MS);
    }

    this.attempts.set(key, entry);
    this.evictIfNeeded();
    return justLocked;
  }

  /** Un acierto borra el historial: quien recuerda su PIN no arrastra los fallos de ayer. */
  registerSuccess(key: string): void {
    this.attempts.delete(key);
  }

  /** Solo para los tests: cuántas claves hay vivas. */
  size(): number {
    return this.attempts.size;
  }

  /**
   * Expulsa la clave más antigua cuando el mapa se llena.
   *
   * Un barrido completo por inserción sería caro; expulsar de una en una mantiene el coste acotado
   * y el tamaño también, que es lo único que importa aquí.
   */
  private evictIfNeeded(): void {
    if (this.attempts.size <= MAX_KEYS) return;

    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [key, entry] of this.attempts) {
      if (entry.touchedAt < oldest) {
        oldest = entry.touchedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) this.attempts.delete(oldestKey);
  }
}
