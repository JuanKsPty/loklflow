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
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { BulkCreateTableDto } from './dto/bulk-create-table.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { QueryTablesDto } from './dto/query-tables.dto';
import { Audit } from '../common/decorators/audit.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { saneOccurredAt } from '../common/occurred-at';

@ApiTags('tables')
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @RequirePermissions('tables:read')
  findAll(@Query() query: QueryTablesDto) {
    return this.tablesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('tables:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.tablesService.findOne(id);
  }

  @Post('bulk')
  @RequirePermissions('tables:create')
  createMany(@Body() dto: BulkCreateTableDto) {
    return this.tablesService.createMany(dto);
  }

  @Post()
  @RequirePermissions('tables:create')
  create(@Body() dto: CreateTableDto) {
    return this.tablesService.create(dto);
  }

  // Ruta literal: debe ir ANTES de @Patch(':id') para que no la capture el comodín.
  @Patch('layout')
  @RequirePermissions('tables:update')
  saveLayout(@Body() dto: UpdateLayoutDto) {
    return this.tablesService.saveLayout(dto.positions);
  }

  @Patch(':id/status')
  @RequirePermissions('tables:update')
  updateStatus(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateTableStatusDto) {
    return this.tablesService.updateStatus(id, dto.status, saneOccurredAt(dto.occurredAt));
  }

  /**
   * Ruta literal antes del comodín `:id`, como `layout`, o `@Patch(':id')` se la comería.
   *
   * `POST` y no `PATCH` porque no se está actualizando un valor que el cliente elige: el
   * servidor genera uno nuevo. Y `qrCode` sigue **fuera** de `CreateTableDto` —del que
   * `UpdateTableDto` es un `PartialType`—, así que ningún cliente puede escoger el token de una
   * mesa. Hoy eso es cierto por accidente; este comentario lo hace deliberado.
   */
  @Post(':id/qr/rotate')
  @RequirePermissions('tables:update')
  @Audit('table.qr_rotated', 'table')
  rotateQr(@Param('id', ParseUuidPipe) id: string) {
    return this.tablesService.rotateQrCode(id);
  }

  @Patch(':id')
  @RequirePermissions('tables:update')
  update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('tables:delete')
  remove(@Param('id', ParseUuidPipe) id: string) {
    return this.tablesService.remove(id);
  }
}
