import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessConfigController } from './business-config.controller';
import { BusinessConfigService } from './business-config.service';
import { BusinessConfig } from './entities/business-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessConfig])],
  controllers: [BusinessConfigController],
  providers: [BusinessConfigService],
})
export class BusinessConfigModule {}
