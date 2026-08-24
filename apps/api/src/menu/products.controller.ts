import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { ProductsImportService } from './products-import.service';
import { ImportProductsDto } from './dto/import-products.dto';
import { UTF8_BOM, toCsv, type CsvColumn } from '../common/csv';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/** Las mismas columnas que acepta el lector del navegador, en el mismo orden. */
const IMPORT_COLUMNS: CsvColumn<Record<string, string>>[] = [
  { key: 'nombre', header: 'nombre' },
  { key: 'descripcion', header: 'descripcion' },
  { key: 'precio', header: 'precio' },
  { key: 'categoria', header: 'categoria' },
  { key: 'estacion', header: 'estacion' },
  { key: 'stock', header: 'stock' },
  { key: 'stock_minimo', header: 'stock_minimo' },
  { key: 'activo', header: 'activo' },
];

/**
 * El BOM hace que el Excel de Windows no lea el archivo como Latin-1 y destroce los acentos, y
 * `sep=,` hace que lo abra **en columnas también en español**, donde el separador de lista es `;`.
 * Nuestro propio lector reconoce esa directiva y la salta, así que la ida y vuelta es exacta.
 */
function csvParaExcel(rows: Record<string, string>[]): Buffer {
  return Buffer.from(`${UTF8_BOM}sep=,\r\n${toCsv(rows, IMPORT_COLUMNS)}`, 'utf-8');
}

@ApiTags('menu')
@Controller('menu/products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly importService: ProductsImportService,
  ) {}

  /**
   * Las tres rutas literales van **antes** que `@Get(':id')`, que está declarado abajo con
   * `ParseUuidPipe`: Nest resuelve por orden de declaración, así que puestas después las capturaría
   * el comodín y la respuesta sería un 400 diciendo que «export.csv» no es un uuid. Es la misma
   * nota que lleva `@Patch('layout')` en `tables.controller.ts`.
   */
  @Get('import-template.csv')
  @RequirePermissions('menu:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="plantilla-productos.csv"')
  async importTemplate() {
    return new StreamableFile(csvParaExcel(await this.importService.templateRows()));
  }

  /**
   * El catálogo actual en el mismo formato que la importación acepta.
   *
   * No estaba en el encargo y cuesta quince líneas: convierte el flujo en «bajo mi lista de
   * precios, la edito en Excel, la vuelvo a subir». Con la coincidencia por nombre, eso compone
   * solo.
   */
  @Get('export.csv')
  @RequirePermissions('menu:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="productos.csv"')
  async exportCsv() {
    return new StreamableFile(csvParaExcel(await this.importService.exportRows()));
  }

  /**
   * Una tanda de filas del CSV. El archivo lo lee y lo previsualiza el navegador; aquí llega ya
   * como JSON validado, sin multipart de por medio.
   *
   * Los dos permisos, no uno: una importación crea **y** actualiza, y `PermissionsGuard` los exige
   * todos. Ninguno es nuevo, así que no hay que sembrar nada ni resembrar en producción.
   * `inventory:create` **no** va aquí: se comprueba en el servicio y solo para las filas que traen
   * existencias, porque un decorador es estático y exigirlo siempre convertiría una importación de
   * menú sin inventario en un 403 para el archivo entero.
   */
  @Post('import')
  @RequirePermissions('menu:create', 'menu:update')
  @Audit('menu.imported', 'product')
  import(@Body() dto: ImportProductsDto, @CurrentUser() user: JwtPayload) {
    return this.importService.import(dto, user);
  }

  @Get()
  @RequirePermissions('menu:read')
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('menu:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @RequirePermissions('menu:create')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('menu:update')
  update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('menu:delete')
  remove(@Param('id', ParseUuidPipe) id: string) {
    return this.productsService.remove(id);
  }
}
