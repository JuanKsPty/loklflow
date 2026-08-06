export interface ThrottleDecision {
  /** Si esta ocurrencia debe escribirse. */
  log: boolean;
  /** Cuántas se callaron desde la última que sí se escribió. Solo tiene sentido si `log`. */
  suppressed: number;
}

/**
 * Deja pasar la primera ocurrencia de cada clave y cuenta las repeticiones de la ventana.
 *
 * Existe por un caso muy concreto: el cliente de Socket.io reintenta la conexión cada pocos
 * segundos **indefinidamente**. Una tablet olvidada encendida con el token caducado escribiría
 * decenas de miles de líneas idénticas por noche, y el log deja de servir para nada. Con esto
 * se escribe la primera, y la siguiente —pasada la ventana— dice cuántas hubo en medio, que es
 * la información que de verdad interesa.
 *
 * `maxKeys` no es decoración: la clave lleva el origen de la conexión, así que sin tope un
 * cliente que rote la IP convertiría este mapa en una fuga de memoria.
 */
export class LogThrottle {
  private readonly seen = new Map<string, { at: number; suppressed: number }>();

  constructor(
    private readonly windowMs = 60_000,
    private readonly maxKeys = 500,
  ) {}

  check(key: string, now: number = Date.now()): ThrottleDecision {
    const entry = this.seen.get(key);

    if (entry && now - entry.at < this.windowMs) {
      entry.suppressed += 1;
      return { log: false, suppressed: entry.suppressed };
    }

    // `delete` + `set` reinserta al final: así el orden del Map es el de última actividad y
    // el desalojo puede quedarse con lo más reciente sin ordenar nada.
    this.seen.delete(key);
    this.seen.set(key, { at: now, suppressed: 0 });
    this.evict();

    return { log: true, suppressed: entry?.suppressed ?? 0 };
  }

  private evict(): void {
    while (this.seen.size > this.maxKeys) {
      const oldest = this.seen.keys().next();
      if (oldest.done) return;
      this.seen.delete(oldest.value);
    }
  }
}
