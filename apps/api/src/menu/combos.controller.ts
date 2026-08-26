import { ApiTags } from '@nestjs/swagger';
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
  Query,
} from '@nestjs/common';
import { CombosService } from './combos.service';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { QueryCombosDto } from './dto/query-combos.dto';

@ApiTags('menu')
@Controller('menu/combos')
export class CombosController {
  constructor(private readonly combosService: CombosService) {}

  @Get()
  @RequirePermissions('menu:read')
  findAll(@Query() query: QueryCombosDto) {
    return this.combosService.findAll(query.q);
  }

  @Get(':id')
  @RequirePermissions('menu:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.combosService.findOne(id);
  }

  @Post()
  @RequirePermissions('menu:create')
  create(@Body() dto: CreateComboDto) {
    return this.combosService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('menu:update')
  update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateComboDto) {
    return this.combosService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('menu:delete')
  remove(@Param('id', ParseUuidPipe) id: string) {
    return this.combosService.remove(id);
  }
}
