import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';

/**
 * Deja constancia de que el proceso se apagó **a propósito**.
 *
 * La primera pregunta de cualquier incidente es si el servicio se reinició o se cayó, y sin
 * esta línea las dos cosas se ven igual: el log simplemente deja de aparecer. Con ella, un
 * `SIGTERM` del orquestador se distingue de un proceso que murió sin decir nada.
 *
 * Depende de `app.enableShutdownHooks()` en `main.ts` para recibir la señal; sin él solo se
 * dispara con un `app.close()` explícito, que es lo que hacen los tests.
 */
@Injectable()
export class ShutdownLogger implements OnApplicationShutdown {
  private readonly logger = new Logger('Process');

  onApplicationShutdown(signal?: string): void {
    this.logger.log({ event: 'shutdown', signal: signal ?? 'close()' });
  }
}
