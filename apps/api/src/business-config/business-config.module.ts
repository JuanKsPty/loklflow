import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessConfigController } from './business-config.controller';
import { BusinessConfigService } from './business-config.service';
import { BusinessConfig } from './entities/business-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessConfig])],
  controllers: [BusinessConfigController],
  providers: [BusinessConfigService],
  // Lo consume el módulo público, que necesita el nombre, el logo y la moneda del negocio para
  // la cabecera del menú del cliente.
  exports: [BusinessConfigService],
})
export class BusinessConfigModule {}
