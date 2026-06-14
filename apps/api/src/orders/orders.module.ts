import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemModifier } from './entities/order-item-modifier.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Product } from '../menu/entities/product.entity';
import { ModifierOption } from '../menu/entities/modifier-option.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderItemModifier,
      OrderStatusHistory,
      Product,
      ModifierOption,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
