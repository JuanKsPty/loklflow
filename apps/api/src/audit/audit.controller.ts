import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  findAll(@Query() query: QueryAuditLogsDto) {
    // El ValidationPipe global (whitelist + transform) valida y castea el DTO,
    // así que `?page=abc` ya no llega como NaN al skip.
    return this.auditService.findAll(query);
  }
}
