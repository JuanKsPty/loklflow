import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductAvailability } from './entities/product-availability.entity';
import { Modifier } from './entities/modifier.entity';
import { ModifierOption } from './entities/modifier-option.entity';
import { Combo } from './entities/combo.entity';
import { ComboItem } from './entities/combo-item.entity';
import { CategoriesController } from './categories.controller';
import { ProductsController } from './products.controller';
import { ModifiersController } from './modifiers.controller';
import { CombosController } from './combos.controller';
import { CategoriesService } from './categories.service';
import { ProductsService } from './products.service';
import { ModifiersService } from './modifiers.service';
import { CombosService } from './combos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Product,
      ProductAvailability,
      Modifier,
      ModifierOption,
      Combo,
      ComboItem,
    ]),
  ],
  controllers: [
    CategoriesController,
    ProductsController,
    ModifiersController,
    CombosController,
  ],
  providers: [CategoriesService, ProductsService, ModifiersService, CombosService],
  exports: [CategoriesService, ProductsService, ModifiersService, CombosService],
})
export class MenuModule {}
