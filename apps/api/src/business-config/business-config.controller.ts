import { Body, Controller, Get, Put } from '@nestjs/common';
import { BusinessConfigService } from './business-config.service';
import { UpdateBusinessConfigDto } from './dto/update-business-config.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@Controller('business-config')
export class BusinessConfigController {
  constructor(private readonly service: BusinessConfigService) {}

  @Get()
  @RequirePermissions('business_config:read')
  get() {
    return this.service.get();
  }

  @Put()
  @RequirePermissions('business_config:update')
  update(@Body() dto: UpdateBusinessConfigDto) {
    return this.service.update(dto);
  }
}
