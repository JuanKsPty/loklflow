import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { SetRecipeDto } from './dto/set-recipe.dto';
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
  ) {}

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
