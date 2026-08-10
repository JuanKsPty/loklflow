import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantTable } from '../tables/entities/table.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { MenuModule } from '../menu/menu.module';
import { BusinessConfigModule } from '../business-config/business-config.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

/**
 * El menú y el pedido desde el QR del cliente.
 *
 * **Compone, no reimplementa.** Importa `OrdersModule` para reutilizar `OrdersService.create` con
 * su idempotencia, su número por secuencia, sus totales del servidor y su aviso a Cocina; y
 * `MenuModule` y `BusinessConfigModule` para el catálogo y la marca del negocio. Lo único propio
 * son las reglas de quién puede pedir y la forma de lo que sale hacia fuera.
 *
 * `JwtModule.register({})` sin secreto a propósito: el del pase de invitado se deriva de
 * `JWT_SECRET` en `PublicService` y se pasa en cada llamada. Registrarlo aquí como secreto por
 * defecto haría que un `jwt.sign()` descuidado en el futuro firmara con él sin querer.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RestaurantTable, Order]),
    OrdersModule,
    MenuModule,
    BusinessConfigModule,
    JwtModule.register({}),
  ],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
