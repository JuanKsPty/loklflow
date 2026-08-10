import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Límite de peticiones para las rutas de sesión.
 *
 * **No es global, y esa es la decisión importante.** Un `ThrottlerGuard` como `APP_GUARD`
 * estrangularía el local entero como si fuera un solo cliente, por tres motivos independientes:
 *
 * 1. **Todo el tráfico de lectura sale de una sola IP.** `serverFetch` corre en el proceso de
 *    Next, no en el navegador, así que para la API las 42 pantallas del negocio son un único
 *    origen. Y `RealtimeRefresher` recarga a todos los clientes ante cada evento: una sola acción
 *    humana con seis pantallas abiertas son 12–18 peticiones.
 * 2. **La cola sin conexión convierte un 429 en pérdida de datos.** La ráfaga de reconexión de una
 *    tablet con veinte operaciones lo dispararía. `outbox.ts` ya trata el 429 como reintentable
 *    —se arregló antes que esto, a propósito—, pero el reintento tiene tope: ocho intentos contra
 *    un límite global y la comanda acaba en la bandeja de fallos igual.
 * 3. **`apiFetch` reintenta cada 401 contra `/auth/refresh`.** Un límite estrecho ahí expulsa al
 *    operario a `/login`, que es la pantalla de email donde un mesero no tiene credenciales.
 *
 * Así que se aplica **solo donde hay algo que adivinar**: el PIN de cuatro dígitos y la
 * contraseña. El resto de la API queda fuera.
 *
 * La clave incluye **a quién** se intenta entrar, no solo desde dónde: en un local todos los
 * dispositivos comparten la IP a ojos de la API, y contar solo por IP haría que un cajero que se
 * equivoca tres veces bloqueara al mesero de la mesa de al lado.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const ip = req.ip ?? 'sin-ip';
    const body = (req.body ?? {}) as { userId?: unknown; email?: unknown };
    // `userId` en el login por PIN, `email` en el de contraseña. Se recorta por si llega basura:
    // esta cadena acaba siendo una clave en un mapa en memoria, y la lección de `LogThrottle`
    // —documentada en CLAUDE.md— es que una clave que viene de fuera necesita tope.
    const subject =
      typeof body.userId === 'string'
        ? body.userId.slice(0, 64)
        : typeof body.email === 'string'
          ? body.email.slice(0, 64).toLowerCase()
          : 'anonimo';
    return `${ip}|${subject}`;
  }

  /**
   * El mensaje no dice cuánto falta ni cuántos intentos quedan.
   *
   * Un «te quedan 2 intentos» le confirma a quien está probando que la cuenta existe y le dice
   * exactamente cuándo volver. El bloqueo por intentos fallidos, que llega con el bloque de
   * seguridad, responde el mismo 401 que un PIN incorrecto por la misma razón.
   */
  protected async throwThrottlingException(_ctx: unknown, _detail: ThrottlerLimitDetail) {
    const { ThrottlerException } = await import('@nestjs/throttler');
    throw new ThrottlerException('Demasiados intentos. Espera un momento y vuelve a probar.');
  }
}
