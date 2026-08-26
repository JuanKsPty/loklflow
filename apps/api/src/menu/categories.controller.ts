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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { QueryCategoriesDto } from './dto/query-categories.dto';

@ApiTags('menu')
@Controller('menu/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions('menu:read')
  findAll(@Query() query: QueryCategoriesDto) {
    return this.categoriesService.findAll(query.q);
  }

  @Get(':id')
  @RequirePermissions('menu:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @RequirePermissions('menu:create')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('menu:update')
  update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('menu:delete')
  remove(@Param('id', ParseUuidPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
