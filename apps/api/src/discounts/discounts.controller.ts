import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { RejectDiscountDto } from './dto/reject-discount.dto';
import { QueryDiscountsDto } from './dto/query-discounts.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/**
 * Bandeja y resolución de descuentos. La solicitud vive en OrdersDiscountController,
 * bajo la ruta de la orden.
 *
 * Ninguno lleva @Audit(): se auditan dentro del service, que es el único sitio donde
 * está el importe del descuento anterior.
 */
@ApiTags('discounts')
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  @RequirePermissions('pos:read')
  findAll(@Query() query: QueryDiscountsDto) {
    return this.discounts.findAll(query);
  }

  @Get('pending-count')
  @RequirePermissions('pos:approve_discount')
  pendingCount() {
    return this.discounts.pendingCount();
  }

  @Get(':id')
  @RequirePermissions('pos:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.discounts.findOne(id);
  }

  @Post(':id/approve')
  @RequirePermissions('pos:approve_discount')
  approve(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.discounts.approve(id, user);
  }

  @Post(':id/reject')
  @RequirePermissions('pos:approve_discount')
  reject(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: RejectDiscountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.discounts.reject(id, dto, user);
  }
}

/** Solicitud de descuento sobre una cuenta, junto al resto de las rutas de la orden. */
@ApiTags('discounts')
@Controller('orders/:id')
export class OrdersDiscountController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post('discount')
  @RequirePermissions('pos:create')
  request(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CreateDiscountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.discounts.request(id, dto, user);
  }

  @Get('discounts')
  @RequirePermissions('pos:read')
  history(@Param('id', ParseUuidPipe) id: string) {
    return this.discounts.findAll({ orderId: id });
  }
}
