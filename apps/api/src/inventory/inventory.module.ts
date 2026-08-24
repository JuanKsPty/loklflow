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
import { ProductStockService } from './product-stock.service';
import { Product } from '../menu/entities/product.entity';
import { InventoryController } from './inventory.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    // `Product` entra como **entidad**, no como `MenuModule`: el inventario necesita leer el
    // nombre y el precio, pero importar el módulo crearía un ciclo en cuanto `MenuModule` importe
    // este para la importación de catálogo.
    TypeOrmModule.forFeature([Supplier, Ingredient, RecipeIngredient, StockMovement, Product]),
    NotificationsModule,
  ],
  controllers: [InventoryController],
  providers: [SuppliersService, IngredientsService, RecipesService, StockService, ProductStockService],
  // `StockService` sale del módulo porque `OrdersModule` lo necesita para descontar al
  // cerrar la cuenta. La dependencia va en un solo sentido —inventario no sabe nada de
  // órdenes más allá de guardar un uuid—, así que no hay ciclo entre módulos.
  // `ProductStockService` sale para que `ProductsService.remove` pueda negarse a borrar un
  // producto con existencias con un 400 en vez de un 500 de clave ajena.
  exports: [StockService, ProductStockService],
})
export class InventoryModule {}
