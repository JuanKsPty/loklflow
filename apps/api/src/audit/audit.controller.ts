import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const [data, total] = await this.auditService.findAll(+page, +limit);
    return { data, total, page: +page, limit: +limit };
  }
}
