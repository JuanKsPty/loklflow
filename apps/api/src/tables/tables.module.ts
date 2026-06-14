import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sector } from './entities/sector.entity';
import { RestaurantTable } from './entities/table.entity';
import { Reservation } from './entities/reservation.entity';
import { SectorsController } from './sectors.controller';
import { TablesController } from './tables.controller';
import { ReservationsController } from './reservations.controller';
import { SectorsService } from './sectors.service';
import { TablesService } from './tables.service';
import { ReservationsService } from './reservations.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sector, RestaurantTable, Reservation]),
    RealtimeModule,
  ],
  // Los controladores de sub-recursos (rutas literales tables/sectors y
  // tables/reservations) deben registrarse ANTES que TablesController, cuyo
  // @Get(':id') captaría esas rutas y fallaría el ParseUuidPipe.
  controllers: [SectorsController, ReservationsController, TablesController],
  providers: [SectorsService, TablesService, ReservationsService],
  exports: [SectorsService, TablesService, ReservationsService],
})
export class TablesModule {}
