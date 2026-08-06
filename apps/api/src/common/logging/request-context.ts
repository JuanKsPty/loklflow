import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** Identificador de la petición en curso. Viaja en la cabecera `x-request-id`. */
  requestId: string;
}

/**
 * El contexto de la petición, disponible en cualquier punto de su cadena asíncrona.
 *
 * Es la única forma de que una línea de log escrita en el fondo de un servicio lleve el id de
 * la petición que la provocó **sin** pasar ese id como parámetro por todas las firmas del
 * proyecto. `AsyncLocalStorage` es API estable de Node desde la 16.
 *
 * Cuidado con los `EventEmitter`: un manejador registrado con `.on()` se ejecuta en el
 * contexto asíncrono de quien emite, no en el de quien lo registró. Ahí el id hay que
 * capturarlo en una variable y pasarlo explícito, que es lo que hace la línea de acceso al
 * escuchar `res.on('finish')`.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
