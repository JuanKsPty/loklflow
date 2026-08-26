import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { IngredientsService } from './ingredients.service';
import { RecipesService } from './recipes.service';
import { StockService } from './stock.service';
import { ProductStockService } from './product-stock.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { SetRecipeDto } from './dto/set-recipe.dto';
import { SetStockDto } from './dto/set-stock.dto';
import { AddStockEntryDto } from './dto/add-stock-entry.dto';
import { QueryProductStockDto } from './dto/query-product-stock.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly ingredients: IngredientsService,
    private readonly recipes: RecipesService,
    private readonly stock: StockService,
    private readonly productStock: ProductStockService,
  ) {}

  // ─── Existencias por producto ───────────────────────────────────────────────
  //
  // El producto *es* la unidad que se cuenta: una botella, una bolsa. Por debajo son ingredientes
  // espejo, pero eso no sale nunca de aquí.

  @Get('products')
  @RequirePermissions('inventory:read')
  findProductStock(@Query() query: QueryProductStockDto) {
    return this.productStock.findAll(query);
  }

  /**
   * «Ahora tengo N.» `PUT` y no `POST` porque la operación es idempotente por su propia forma:
   * reenviarla desde una conexión mala deja el mismo número en vez de dos ajustes acumulados.
   * Crea el espejo la primera vez; no hay paso previo de «activar».
   */
  @Put('products/:productId/stock')
  @RequirePermissions('inventory:update')
  setProductStock(
    @Param('productId', ParseUuidPipe) productId: string,
    @Body() dto: SetStockDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productStock.setStock(productId, dto, user.sub);
  }

  /**
   * «Llegó mercancía.» **Suma** lo que llegó, no fija un total.
   *
   * Ruta propia y no un `POST` sobre `products/:id/stock` a secas: distinguir «suma» de «fija»
   * solo por el verbo HTTP es justo el matiz que se lee mal a las once de la noche. `POST` porque
   * **no** es idempotente —reenviarla suma dos veces—, igual que `POST movements`; la pantalla lo
   * cubre deshabilitando el botón mientras envía.
   */
  @Post('products/:productId/stock/entry')
  @RequirePermissions('inventory:update')
  addProductStockEntry(
    @Param('productId', ParseUuidPipe) productId: string,
    @Body() dto: AddStockEntryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productStock.addEntry(productId, dto, user.sub);
  }

  // Baja lógica del espejo, no borrado: el libro mayor tiene que sobrevivir.
  @Delete('products/:productId/stock')
  @RequirePermissions('inventory:delete')
  untrackProduct(@Param('productId', ParseUuidPipe) productId: string) {
    return this.productStock.untrack(productId);
  }

  // ─── Proveedores ────────────────────────────────────────────────────────────

  @Get('suppliers')
  @RequirePermissions('inventory:read')
  findSuppliers() {
    return this.suppliers.findAll();
  }

  @Get('suppliers/:id')
  @RequirePermissions('inventory:read')
  findSupplier(@Param('id', ParseUuidPipe) id: string) {
    return this.suppliers.findOne(id);
  }

  @Post('suppliers')
  @RequirePermissions('inventory:create')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliers.create(dto);
  }

  @Patch('suppliers/:id')
  @RequirePermissions('inventory:update')
  updateSupplier(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(id, dto);
  }

  // Baja lógica, no DELETE: el proveedor está referenciado por sus entradas de mercancía.
  @Patch('suppliers/:id/deactivate')
  @RequirePermissions('inventory:delete')
  deactivateSupplier(@Param('id', ParseUuidPipe) id: string) {
    return this.suppliers.deactivate(id);
  }

  // ─── Ingredientes ───────────────────────────────────────────────────────────

  @Get('ingredients')
  @RequirePermissions('inventory:read')
  findIngredients(@Query('lowStock') lowStock?: string) {
    return lowStock === 'true' ? this.ingredients.findLowStock() : this.ingredients.findAll();
  }

  @Get('ingredients/:id')
  @RequirePermissions('inventory:read')
  findIngredient(@Param('id', ParseUuidPipe) id: string) {
    return this.ingredients.findOne(id);
  }

  @Post('ingredients')
  @RequirePermissions('inventory:create')
  createIngredient(@Body() dto: CreateIngredientDto, @CurrentUser() user: JwtPayload) {
    return this.ingredients.create(dto, user.sub);
  }

  @Patch('ingredients/:id')
  @RequirePermissions('inventory:update')
  updateIngredient(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateIngredientDto) {
    return this.ingredients.update(id, dto);
  }

  @Put('ingredients/:id/stock')
  @RequirePermissions('inventory:update')
  setIngredientStock(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: SetStockDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.stock.setLevel(
      { ingredientId: id, toStock: dto.newStock, reasonCode: dto.reasonCode, note: dto.note },
      user.sub,
    );
  }

  @Patch('ingredients/:id/deactivate')
  @RequirePermissions('inventory:delete')
  deactivateIngredient(@Param('id', ParseUuidPipe) id: string) {
    return this.ingredients.deactivate(id);
  }

  // ─── Recetas ────────────────────────────────────────────────────────────────

  @Get('recipes/:productId')
  @RequirePermissions('inventory:read')
  findRecipe(@Param('productId', ParseUuidPipe) productId: string) {
    return this.recipes.findByProduct(productId);
  }

  // PUT y no PATCH: la receta se reemplaza entera desde la ficha del producto.
  @Put('recipes/:productId')
  @RequirePermissions('inventory:update')
  setRecipe(@Param('productId', ParseUuidPipe) productId: string, @Body() dto: SetRecipeDto) {
    return this.recipes.setForProduct(productId, dto);
  }

  // ─── Movimientos ────────────────────────────────────────────────────────────

  @Get('movements')
  @RequirePermissions('inventory:read')
  findMovements(@Query('ingredientId') ingredientId?: string, @Query('take') take?: string) {
    return this.stock.findMovements({
      ingredientId,
      take: take ? Number(take) : undefined,
    });
  }

  /**
   * Entrada de mercancía, merma o ajuste. `consumption` no se acepta: lo escribe el cierre
   * de cuenta con su orden detrás, y abrirlo por API permitiría fabricar consumos sin venta.
   */
  @Post('movements')
  @RequirePermissions('inventory:update')
  createMovement(@Body() dto: CreateMovementDto, @CurrentUser() user: JwtPayload) {
    return this.stock.record(dto, user.sub);
  }
}
