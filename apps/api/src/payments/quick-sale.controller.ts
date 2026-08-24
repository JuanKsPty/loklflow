import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post } from '@nestjs/common';
import { QuickSaleService } from './quick-sale.service';
import { QuickSaleDto } from './dto/quick-sale.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('orders')
@Controller('orders')
export class QuickSaleController {
  constructor(private readonly quickSale: QuickSaleService) {}

  /**
   * Venta de mostrador: crea la cuenta, la cobra entera y la cierra en una sola petición.
   *
   * Ruta literal bajo `/orders`, servida desde `PaymentsModule`. No choca con nada:
   * `OrdersController` no declara ningún `@Post(':id')`. Hay un test que lo afirma, porque el día
   * que alguien lo añada ganaría esa ruta —`OrdersModule` se importa antes en `AppModule`— y esto
   * dejaría de responder.
   *
   * Los dos permisos, no uno: `PermissionsGuard` los exige todos, así que esto queda para quien ya
   * podía hacer las dos mitades por separado. Y ninguno es nuevo, así que no hay que resembrar.
   */
  @Post('quick-sale')
  @RequirePermissions('orders:create', 'pos:create')
  create(@Body() dto: QuickSaleDto, @CurrentUser() user: JwtPayload) {
    return this.quickSale.execute(dto, user.sub);
  }
}
