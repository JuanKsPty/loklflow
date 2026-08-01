import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Cuánto vale una comprobación antes de repetirla.
 *
 * `/api/ready` es `@Public()`: sin caché, cualquiera desde internet dispara un `SELECT 1` por
 * petición contra un pool de diez conexiones. Con ella, el peor caso es una consulta cada
 * cinco segundos por muchas sondas que haya.
 */
const READY_CACHE_MS = 5_000;

/**
 * Tope para la consulta de la sonda. Sin él, con la base inalcanzable la petición se queda
 * colgada hasta que el sistema operativo se rinde, y la sonda —que existe para detectar justo
 * eso— es la última en enterarse.
 */
const PROBE_TIMEOUT_MS = 2_000;

export interface ReadyResult {
  ok: boolean;
  error?: string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private cached?: { at: number; result: ReadyResult };
  private inFlight?: Promise<ReadyResult>;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Vivo: el proceso responde.
   *
   * A propósito **no** toca la base de datos. Es lo que mira el `HEALTHCHECK` de la imagen, y
   * un proceso sano no debe marcarse como enfermo —ni reiniciarse— por un parpadeo de la
   * base, que es un problema distinto y con su propio endpoint.
   */
  health(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Listo: además de responder, puede atender de verdad.
   *
   * Es un endpoint nuevo en lugar de un cambio en `/api/health` por lo de arriba, y porque
   * `guards.int-spec.ts` compara el cuerpo de salud con `toEqual({ status: 'ok' })` —la única
   * aserción exacta de toda la suite—, que se rompería a cambio de nada.
   */
  async ready(): Promise<ReadyResult> {
    const cached = this.cached;
    if (cached && Date.now() - cached.at < READY_CACHE_MS) return cached.result;

    // Una sola comprobación en vuelo aunque lleguen veinte peticiones a la vez: la caché sola
    // no protege de la ráfaga inicial, porque ninguna habría terminado todavía.
    this.inFlight ??= this.probe().finally(() => {
      this.inFlight = undefined;
    });

    const result = await this.inFlight;
    this.cached = { at: Date.now(), result };
    return result;
  }

  private async probe(): Promise<ReadyResult> {
    const previous = this.cached?.result.ok;
    try {
      await withTimeout(this.dataSource.query('SELECT 1'), PROBE_TIMEOUT_MS);
      if (previous === false) this.logger.log({ event: 'ready:recovered' });
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      // Solo al cambiar de estado. Registrarlo en cada sonda convertiría un incidente de una
      // hora en cientos de líneas iguales, y el detalle del fallo no viaja en la respuesta:
      // el endpoint es público y el mensaje del driver dice host y puerto.
      if (previous !== false) this.logger.error({ event: 'ready:failed', error });
      return { ok: false, error };
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // La promesa que pierda la carrera sigue viva. Sin este `catch` su rechazo tardío llegaría
  // como `unhandledRejection`, y con la base caída sería la propia sonda de salud la que
  // ensuciara el log cada pocos segundos —o, con un manejador que cierre el proceso, la que
  // matara al servidor que venía a vigilar.
  promise.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`sin respuesta en ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
