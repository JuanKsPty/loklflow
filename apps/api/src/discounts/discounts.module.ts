import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Discount } from './entities/discount.entity';
import { DiscountsController, OrdersDiscountController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { OrdersModule } from '../orders/orders.module';
import { RolesModule } from '../roles/roles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Discount]),
    OrdersModule,
    RolesModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [DiscountsController, OrdersDiscountController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
