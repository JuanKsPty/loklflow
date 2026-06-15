import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('current')
  @RequirePermissions('pos:read')
  async current(@CurrentUser() user: JwtPayload) {
    const shift = await this.shiftsService.currentForUser(user.sub);
    return shift ? this.shiftsService.summary(shift.id) : null;
  }

  @Get()
  @RequirePermissions('pos:read')
  list(@CurrentUser() user: JwtPayload) {
    return this.shiftsService.listForUser(user.sub);
  }

  @Get(':id/summary')
  @RequirePermissions('pos:read')
  summary(@Param('id', ParseUuidPipe) id: string) {
    return this.shiftsService.summary(id);
  }

  @Post('open')
  @RequirePermissions('pos:create')
  open(@Body() dto: OpenShiftDto, @CurrentUser() user: JwtPayload) {
    return this.shiftsService.openShift(user.sub, dto);
  }

  @Post(':id/close')
  @RequirePermissions('pos:create')
  close(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CloseShiftDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.shiftsService.closeShift(user.sub, id, dto);
  }
}
