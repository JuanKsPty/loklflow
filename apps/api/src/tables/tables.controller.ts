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
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @RequirePermissions('tables:read')
  findAll() {
    return this.tablesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('tables:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.tablesService.findOne(id);
  }

  @Post()
  @RequirePermissions('tables:create')
  create(@Body() dto: CreateTableDto) {
    return this.tablesService.create(dto);
  }

  @Patch(':id/status')
  @RequirePermissions('tables:update')
  updateStatus(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateTableStatusDto) {
    return this.tablesService.updateStatus(id, dto.status);
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
