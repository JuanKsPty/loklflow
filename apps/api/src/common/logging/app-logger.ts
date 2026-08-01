import { ConsoleLogger, type ConsoleLoggerOptions, type LogLevel } from '@nestjs/common';
import { currentRequestId } from './request-context';

/**
 * Los niveles de Nest, de menos a más grave. Nest no tiene jerarquía: `logLevels` es una
 * lista explícita. Esta constante existe para poder traducir un mínimo (`LOG_LEVEL=warn`) a
 * la lista que espera, en vez de obligar a enumerarlos en el .env.
 */
const LEVELS: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];

/** Forma del objeto que `ConsoleLogger` serializa por línea cuando `json` está activo. */
interface JsonLogOptions {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: 'stdout' | 'stderr';
  errorStack?: unknown;
}

/**
 * `ConsoleLogger` con el id de la petición metido en cada línea.
 *
 * Se **extiende `ConsoleLogger`, nunca `Logger`**: `Logger.overrideLogger` rechaza con un
 * error cualquier instancia que sea `instanceof Logger` con otro constructor, así que un
 * logger propio derivado de `Logger` revienta el arranque.
 *
 * Tampoco hace falta escribir uno desde cero: `ConsoleLoggerOptions` ya trae `json`, y con
 * `colors: false` y `compact: true` —los valores por defecto cuando `json` está activo— la
 * salida pasa por `JSON.stringify`, es decir, una línea por registro y parseable con `jq`.
 * Lo único que Nest no hace es correlacionar líneas con peticiones, y eso es este archivo.
 */
export class AppLogger extends ConsoleLogger {
  protected getJsonLogObject(
    message: unknown,
    options: JsonLogOptions,
  ): {
    level: LogLevel;
    pid: number;
    timestamp: number;
    message: unknown;
    context?: string;
    stack?: unknown;
    requestId?: string;
  } {
    const logObject = super.getJsonLogObject(message, options);
    const requestId = currentRequestId();
    return requestId ? { ...logObject, requestId } : logObject;
  }
}

/**
 * Niveles activos a partir de `LOG_LEVEL`, entendido como **mínimo**.
 *
 * Sin la variable se activan los seis, que es exactamente lo que hacía Nest antes de este
 * cambio: introducir observabilidad no debe apagar en silencio nada de lo que ya se veía.
 */
export function logLevelsFromEnv(value = process.env.LOG_LEVEL): LogLevel[] {
  const min = value?.trim().toLowerCase();
  const index = min ? LEVELS.indexOf(min as LogLevel) : -1;
  return index === -1 ? [...LEVELS] : LEVELS.slice(index);
}

/**
 * El logger de la aplicación.
 *
 * JSON en producción —donde lo lee una máquina: `docker logs api | jq`— y el formato de
 * siempre, con colores, fuera de ella, donde lo lee una persona. `LOG_FORMAT` fuerza
 * cualquiera de los dos.
 */
export function createAppLogger(options: ConsoleLoggerOptions = {}): AppLogger {
  const format = process.env.LOG_FORMAT?.trim().toLowerCase();
  const json = format ? format === 'json' : process.env.NODE_ENV === 'production';

  return new AppLogger({ json, logLevels: logLevelsFromEnv(), ...options });
}
