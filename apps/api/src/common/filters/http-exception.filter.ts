import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { currentRequestId } from '../logging/request-context';

/**
 * Códigos que son parte del funcionamiento normal y no señalan nada roto: una sesión que
 * caducó, un marcador antiguo, alguien que abre una pantalla para la que no tiene permiso.
 * Se registran, pero al nivel más bajo, porque en volumen son casi todo el 4xx.
 */
const ROUTINE_STATUSES = new Set<number>([
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
]);

/** Campos de un error de TypeORM que sirven para diagnosticar. Ver `describe()`. */
interface QueryFailure {
  code?: string;
  constraint?: string;
  table?: string;
  query?: string;
}

/**
 * Da forma al cuerpo del error **y deja constancia de él**.
 *
 * Lo segundo es nuevo y corrige un daño que este mismo archivo causaba: al estar anotado con
 * `@Catch()` sin argumentos y registrarse como filtro global, desplaza al `BaseExceptionFilter`
 * de Nest, que registra con `logger.error(exception)` toda excepción que no sea intrínseca.
 * Este filtro formateaba la respuesta y **tiraba el objeto**: con él, la pila, la causa y —si
 * era un `QueryFailedError`— la consulta que falló no aparecían en ningún sitio. Registrarlo
 * no es que no añadiera logging: quitó el que Nest daba gratis.
 *
 * Restaurarlo tal cual sería ruidoso, porque Nest registra también cada 401 y cada 400 como
 * error. De ahí la separación por severidad de abajo, que además mantiene callados los tests
 * de integración: `TestingLogger` silencia `log`, `warn`, `debug` y `verbose`, pero **reenvía
 * `error()`**. Si los 4xx provocados a propósito se registraran como error, la suite se
 * llenaría de trazas y dejaría de servir para detectar las de verdad.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    // El filtro es global y `@Catch()` sin argumentos, así que también atiende excepciones
    // de contextos que no son HTTP —websockets, por ejemplo—, donde `getResponse()` no
    // devuelve una respuesta de Express y el `.status()` de abajo reventaría dentro del
    // propio filtro. Ahí lo único sensato es registrarlo y no tocar nada.
    if (host.getType() !== 'http') {
      this.error({ context: host.getType(), error: describe(exception) }, stackOf(exception));
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const requestId = currentRequestId();
    this.report(exception, status, request, requestId);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      // Va en el cuerpo, no solo en la cabecera, para que quien vea el error en pantalla
      // pueda dictarlo por teléfono y sea el mismo id que aparece en el log del servidor.
      ...(requestId ? { requestId } : {}),
      message:
        typeof message === 'object' && 'message' in (message as object)
          ? (message as { message: string | string[] }).message
          : message,
    });
  }

  private report(
    exception: unknown,
    status: number,
    request: Request,
    requestId: string | undefined,
  ): void {
    const entry = {
      requestId,
      status,
      method: request.method,
      url: request.originalUrl,
      error: describe(exception),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.error(entry, stackOf(exception));
      return;
    }
    if (ROUTINE_STATUSES.has(status)) {
      this.logger.log(entry);
      return;
    }
    this.logger.warn(entry);
  }

  /**
   * Pasar `undefined` como pila **no** equivale a omitir el argumento.
   *
   * `ConsoleLogger` solo lo interpreta como pila si el texto tiene forma de pila; en cualquier
   * otro caso lo trata como un mensaje más, así que un error sin `stack` —los hay: cualquier
   * `HttpException` lanzada sin causa— produciría una segunda línea de log con la palabra
   * «undefined» dentro.
   */
  private error(entry: object, stack: string | undefined): void {
    if (stack) this.logger.error(entry, stack);
    else this.logger.error(entry);
  }
}

function stackOf(exception: unknown): string | undefined {
  return exception instanceof Error ? exception.stack : undefined;
}

/**
 * Describe la excepción **sin arrastrar datos del usuario**.
 *
 * El detalle importa: `QueryFailedError` de TypeORM lleva los `parameters` enlazados de la
 * consulta, y un insert fallido en `users` los pondría en el log — incluido el hash bcrypt
 * del PIN. Por eso aquí se eligen los campos uno a uno en lugar de volcar el objeto: el
 * `query` (que solo tiene `$1`, `$2`…) y el nombre de la restricción sirven para diagnosticar,
 * los valores no. Por lo mismo se omite `detail`, donde Postgres sí escribe los valores de la
 * fila que chocó.
 */
function describe(exception: unknown): Record<string, unknown> {
  if (!(exception instanceof Error)) {
    return { name: typeof exception, message: String(exception) };
  }

  const failure = exception as Error & QueryFailure;
  const cause = exception.cause;

  return {
    name: exception.name,
    message: exception.message,
    ...(failure.code ? { code: failure.code } : {}),
    ...(failure.constraint ? { constraint: failure.constraint } : {}),
    ...(failure.table ? { table: failure.table } : {}),
    ...(failure.query ? { query: failure.query } : {}),
    ...(cause instanceof Error ? { cause: `${cause.name}: ${cause.message}` } : {}),
  };
}
