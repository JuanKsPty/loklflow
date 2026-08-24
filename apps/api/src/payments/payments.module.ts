import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { QuickSaleController } from './quick-sale.controller';
import { QuickSaleService } from './quick-sale.service';
import { OrdersModule } from '../orders/orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    OrdersModule,
    RealtimeModule,
    ShiftsModule,
    AuditModule,
  ],
  // La venta de mostrador vive aquí y no en `orders/` porque necesita `OrdersService` **y**
  // `PaymentsService`, y este módulo ya importa aquel: al revés habría ciclo.
  controllers: [PaymentsController, QuickSaleController],
  providers: [PaymentsService, QuickSaleService],
})
export class PaymentsModule {}
