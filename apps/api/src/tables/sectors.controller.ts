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
import { SectorsService } from './sectors.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';

@Controller('tables/sectors')
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Get()
  @RequirePermissions('tables:read')
  findAll() {
    return this.sectorsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('tables:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.sectorsService.findOne(id);
  }

  @Post()
  @RequirePermissions('tables:create')
  create(@Body() dto: CreateSectorDto) {
    return this.sectorsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tables:update')
  update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateSectorDto) {
    return this.sectorsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('tables:delete')
  remove(@Param('id', ParseUuidPipe) id: string) {
    return this.sectorsService.remove(id);
  }
}
