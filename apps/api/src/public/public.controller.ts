import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PublicService } from './public.service';
import { PublicThrottlerGuard } from './public-throttler.guard';
import { ParseQrCodePipe } from './parse-qr-code.pipe';
import { PublicCreateOrderDto } from './dto/public-create-order.dto';
import { GUEST_TOKEN_HEADER } from './guest-token';

/**
 * Toda la superficie que alcanza alguien sin sesión, en un archivo.
 *
 * **Por qué un módulo aparte y no `@Public()` sobre los controladores que ya existen.** El motivo
 * de peso es que el moldeado de la respuesta hace falta de todos modos: `@Public()` sobre
 * `ProductsController.findAll` publicaría productos inactivos, ignoraría el horario y entregaría el
 * payload de administración; sobre `TablesController.findOne` filtraría el `qrCode` de la mesa, su
 * estado y su capacidad. Los handlers son código nuevo en cualquier caso, y el código nuevo va en
 * un módulo nuevo.
 *
 * El motivo secundario, que se agradece cada vez que alguien audita: `CLAUDE.md` obliga a que cada
 * ruta declare `@RequirePermissions` o `@Public()`, y así la respuesta a «¿qué alcanza un
 * desconocido?» es **este archivo, leído de arriba abajo**.
 *
 * `PermissionsGuard` devuelve `true` cuando no hay metadatos de permisos, así que `@Public()` por
 * sí solo abre la ruta: no hace falta nada más, y por eso conviene que estén todas juntas.
 */
@ApiTags('public')
@Controller('public')
@UseGuards(PublicThrottlerGuard)
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * Sesenta por minuto **y por mesa**. Varios comensales recargan el menú mientras deciden, y en
   * la WiFi del local todos comparten IP: contarlo por IP le habría negado el menú al cuarto
   * cliente del restaurante. Ver `PublicThrottlerGuard`.
   */
  @Public()
  @Throttle({ sesion: { ttl: 60_000, limit: 60 } })
  @Get('menu/:qrCode')
  menu(@Param('qrCode', ParseQrCodePipe) qrCode: string) {
    return this.publicService.menuFor(qrCode);
  }

  /**
   * Doce cada cinco minutos y por mesa. Cada petición que pasa ocupa una mesa y manda una comanda a
   * la cocina, así que el tope es bajo; pero tiene que dejar sitio a una mesa grande donde cada
   * comensal pide desde su teléfono y alguno se equivoca.
   *
   * Aun así el límite de peticiones es la defensa **menos** importante de este endpoint. Las que
   * cuentan son de dominio y están en el servicio: la mesa tiene que estar recibiendo pedidos, hay
   * un tope de pedidos vivos por mesa, y las cantidades y el número de líneas están acotados en el
   * DTO — un `{ quantity: 999999 }` es una sola petición bien formada que ningún límite atrapa.
   */
  @Public()
  @Throttle({ sesion: { ttl: 300_000, limit: 12 } })
  @Post('menu/:qrCode/orders')
  createOrder(
    @Param('qrCode', ParseQrCodePipe) qrCode: string,
    @Body() dto: PublicCreateOrderDto,
  ) {
    return this.publicService.createOrder(qrCode, dto);
  }

  /**
   * El estado del pedido. **Sin identificador en la ruta**: sale del pase firmado.
   *
   * Así no hay nada que enumerar, y el id no queda en el historial del navegador, ni en el
   * `Referer`, ni en las líneas de acceso que escribe `LOG_HTTP`.
   *
   * El cliente lo consulta cada diez segundos mientras la pestaña está visible, porque el gateway
   * de tiempo real rechaza cualquier handshake sin `access_token` y abrir una sala anónima sería
   * mucha más superficie de la que vale un estado que cambia tres veces por comida.
   */
  @Public()
  @Throttle({ sesion: { ttl: 60_000, limit: 40 } })
  @Get('orders/me')
  myOrder(@Headers(GUEST_TOKEN_HEADER) token?: string) {
    return this.publicService.orderByToken(token);
  }
}
