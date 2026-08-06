import { unstable_rethrow } from 'next/navigation';
import { isOffline } from '@/lib/api/server-client';
import { reportServerError } from './report';

/**
 * Deja constancia de un fallo de la API en un Server Component y dice cómo contárselo al
 * operario.
 *
 * Existe por un hueco que dejó el bloque anterior, y es mío: aquellos `catch` se quedan el
 * error y devuelven el aviso de «sin conexión» **sin relanzar nada**, así que `onRequestError`
 * de Next nunca los ve —solo recibe lo que llega hasta él sin capturar—. Resultado: las
 * pantallas dejaron de mentir, pero un fallo real de la API seguía sin aparecer en ningún log.
 *
 * Devuelve el motivo para que el aviso distinga «no hay red» de «el servidor contestó mal»,
 * que llevan a acciones distintas: la primera se arregla desde el salón, la segunda no.
 */
export function reportApiFailure(scope: string, err: unknown): 'offline' | 'error' {
  // Lo primero, siempre: devolver a Next lo que es suyo.
  //
  // `notFound()`, `redirect()` y la señal de renderizado dinámico viajan **como excepciones**,
  // así que un `catch` ancho las atrapa. Sin esto, el build llenaba la salida con tres trazas
  // enormes: durante el prerenderizado Next lanza `DynamicServerError` al ver que la página usa
  // `cookies`, estos `catch` se lo tragaban y lo reportaban como si fuera un fallo de la API.
  // Peor que el ruido es lo que significa: capturar una señal de control de Next es quitarle
  // la información con la que decide cómo renderizar la página.
  unstable_rethrow(err);

  reportServerError(scope, err);
  return isOffline(err) ? 'offline' : 'error';
}
