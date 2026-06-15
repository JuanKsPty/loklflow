import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SetTipDto } from './dto/set-tip.dto';
import { OrdersService } from '../orders/orders.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Controller('orders/:id')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('payments')
  @RequirePermissions('pos:read')
  summary(@Param('id', ParseUuidPipe) id: string) {
    return this.paymentsService.summary(id);
  }

  @Post('payments')
  @RequirePermissions('pos:create')
  addPayment(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.addPayment(id, dto, user.sub);
  }

  @Patch('tip')
  @RequirePermissions('pos:create')
  setTip(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: SetTipDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.setTip(id, dto.tipAmount, user.sub);
  }
}
