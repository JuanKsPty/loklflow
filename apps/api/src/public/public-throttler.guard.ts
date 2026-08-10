import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Límite de peticiones de las rutas públicas, contado **por mesa** y no por IP.
 *
 * La IP no sirve aquí, y el motivo es específico de este producto: los clientes que se conectan a
 * la WiFi del local **comparten una sola IP** a ojos de la API. Un límite de tres pedidos por IP
 * cada cinco minutos bloquearía al cuarto cliente del restaurante entero, y el mensaje que vería
 * es «demasiados intentos» cuando no ha intentado nada. Quien viene por datos móviles sí trae IP
 * propia, así que el mismo límite se aplicaría de forma completamente distinta a dos clientes
 * sentados en la misma mesa.
 *
 * La mesa, en cambio, es la unidad natural: es lo que el QR identifica, lo que acota el destrozo de
 * un código filtrado, y lo que se corresponde con el tope de pedidos vivos que aplica el servicio.
 *
 * Se combina con la IP igualmente —`ip|mesa`— para que un atacante con muchas IPs no pueda usar la
 * misma mesa desde todas, y para que una mesa cuyo QR se filtró no bloquee a la mesa real.
 */
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const params = (req.params ?? {}) as { qrCode?: unknown };
    const qr = typeof params.qrCode === 'string' ? params.qrCode.slice(0, 64) : 'sin-mesa';
    return `${req.ip ?? 'sin-ip'}|${qr}`;
  }

  /** Igual que en las rutas de sesión: el mensaje no dice cuánto falta ni cuántos quedan. */
  protected async throwThrottlingException(_ctx: unknown, _detail: ThrottlerLimitDetail) {
    const { ThrottlerException } = await import('@nestjs/throttler');
    throw new ThrottlerException('Demasiadas peticiones. Espera un momento y vuelve a probar.');
  }
}
