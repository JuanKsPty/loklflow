import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { SuppliersService } from './suppliers.service';
import { IngredientsService } from './ingredients.service';
import { RecipesService } from './recipes.service';
import { StockService } from './stock.service';
import { InventoryController } from './inventory.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, Ingredient, RecipeIngredient, StockMovement]),
    NotificationsModule,
  ],
  controllers: [InventoryController],
  providers: [SuppliersService, IngredientsService, RecipesService, StockService],
  // `StockService` sale del módulo porque `OrdersModule` lo necesita para descontar al
  // cerrar la cuenta. La dependencia va en un solo sentido —inventario no sabe nada de
  // órdenes más allá de guardar un uuid—, así que no hay ciclo entre módulos.
  exports: [StockService],
})
export class InventoryModule {}
