import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Controller('tables/reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @RequirePermissions('tables:read')
  findAll() {
    return this.reservationsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('tables:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  @RequirePermissions('tables:create')
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: JwtPayload) {
    return this.reservationsService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('tables:update')
  update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateReservationDto) {
    return this.reservationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('tables:delete')
  remove(@Param('id', ParseUuidPipe) id: string) {
    return this.reservationsService.remove(id);
  }
}
