import { Logger } from '@nestjs/common';

/**
 * Margen para que la última línea salga antes de morir.
 *
 * `process.stdout.write` es **asíncrono cuando la salida es una tubería**, que es exactamente
 * lo que hay dentro de un contenedor. Llamar a `process.exit()` justo después de registrar el
 * fallo se come la línea que explica por qué se cayó, que es la única que importaba.
 */
const EXIT_FLUSH_MS = 150;

/**
 * Registra los dos fallos que ocurren **fuera** del ciclo de una petición HTTP y que, por
 * tanto, ningún filtro de excepciones ve.
 *
 * Sin esto, un `uncaughtException` mata el proceso con el volcado por defecto de Node —texto
 * plano, fuera del formato del resto— y el contenedor reinicia sin que quede constancia
 * legible de la causa.
 */
export function installProcessHandlers(): void {
  const logger = new Logger('Process');

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ event: 'uncaughtException', error: error.message }, error.stack);
    // El estado del proceso ya no es de fiar: se sale para que el orquestador levante uno
    // limpio. `exitCode` va antes por si el bucle se vacía y el proceso termina solo.
    process.exitCode = 1;
    setTimeout(() => process.exit(1), EXIT_FLUSH_MS).unref();
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : undefined;
    const entry = { event: 'unhandledRejection', error: error?.message ?? String(reason) };
    // El `stack` va solo si existe: `ConsoleLogger` no ignora un `undefined` en esa
    // posición, lo imprime como un mensaje más.
    if (error?.stack) logger.error(entry, error.stack);
    else logger.error(entry);
    // A diferencia del anterior, aquí **no** se sale, y es deliberado: desde Node 15 el
    // comportamiento por defecto es tumbar el proceso, y esto es una caja registradora. Una
    // promesa suelta que nadie esperaba no puede dejar al cajero sin sistema a media venta.
    // El precio —seguir con un estado posiblemente incompleto— es menor que el de cerrar.
  });
}
