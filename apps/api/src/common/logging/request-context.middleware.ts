import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Un id de fuera solo se acepta si tiene esta forma.
 *
 * No es paranoia: el valor acaba escrito en cada línea de log. Sin comprobarlo, cualquiera
 * podría meter saltos de línea y **fabricar registros falsos**, o mandar un megabyte y
 * multiplicar el tamaño de todo lo que se registre durante esa petición. Si no encaja, se
 * ignora y se genera uno nuevo, que es más barato que discutirlo con el cliente.
 */
const VALID_REQUEST_ID = /^[A-Za-z0-9_.:-]{8,64}$/;

type HttpLogMode = 'off' | 'errors' | 'all';

/**
 * Qué peticiones dejan línea de acceso. Por defecto **solo las que fallan**.
 *
 * Registrarlas todas parece lo obvio y en esta aplicación no lo es: `RealtimeRefresher` hace
 * `router.refresh()` en todos los clientes conectados ante cada evento, así que una sola
 * acción humana con seis dispositivos abiertos genera del orden de 12–18 peticiones. El log
 * útil quedaría enterrado. `LOG_HTTP=all` lo activa cuando se está depurando.
 */
function httpLogMode(value = process.env.LOG_HTTP): HttpLogMode {
  const mode = value?.trim().toLowerCase();
  return mode === 'all' || mode === 'off' ? mode : 'errors';
}

function incomingRequestId(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return value && VALID_REQUEST_ID.test(value) ? value : undefined;
}

/**
 * Abre el contexto de la petición y, si procede, deja la línea de acceso.
 *
 * Va en un **middleware** y no en un interceptor porque `JwtAuthGuard` y `PermissionsGuard`
 * están registrados como `APP_GUARD` y resuelven antes que cualquier interceptor: un id
 * generado ahí faltaría justo en los 401 y 403, que son los que más se investigan.
 *
 * Y se registra desde `AppModule.configure()`, no con `app.use()` en `main.ts`, porque
 * `createTestApp()` replica los globales a mano y **no ejecuta `main.ts`**: puesto solo allí,
 * este middleware tendría cero cobertura en los tests de integración.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly mode = httpLogMode();

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = incomingRequestId(req.headers[REQUEST_ID_HEADER]) ?? randomUUID();
    // Se devuelve siempre, también en las respuestas correctas: es lo que permite que el
    // navegador guarde el id en su `ApiError` y que un operario pueda leerlo en pantalla.
    res.setHeader(REQUEST_ID_HEADER, requestId);

    if (this.mode !== 'off') {
      const startedAt = process.hrtime.bigint();
      res.on('finish', () => {
        if (this.mode === 'errors' && res.statusCode < 400) return;
        // El id va explícito y no por el contexto asíncrono: este manejador lo invoca el
        // emisor de `finish`, que puede estar en otra cadena asíncrona.
        this.logger.log({
          requestId,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          ms: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10,
        });
      });
    }

    requestContext.run({ requestId }, next);
  }
}
