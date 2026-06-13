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
import { ModifiersService } from './modifiers.service';
import { CreateModifierDto } from './dto/create-modifier.dto';
import { UpdateModifierDto } from './dto/update-modifier.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';

@Controller('menu/modifiers')
export class ModifiersController {
  constructor(private readonly modifiersService: ModifiersService) {}

  @Get()
  @RequirePermissions('menu:read')
  findAll() {
    return this.modifiersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('menu:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.modifiersService.findOne(id);
  }

  @Post()
  @RequirePermissions('menu:create')
  create(@Body() dto: CreateModifierDto) {
    return this.modifiersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('menu:update')
  update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateModifierDto) {
    return this.modifiersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('menu:delete')
  remove(@Param('id', ParseUuidPipe) id: string) {
    return this.modifiersService.remove(id);
  }
}
