import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Ingredient } from './entities/ingredient.entity';
import { SetRecipeDto } from './dto/set-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(RecipeIngredient) private readonly recipesRepo: Repository<RecipeIngredient>,
    @InjectRepository(Ingredient) private readonly ingredientsRepo: Repository<Ingredient>,
    private readonly dataSource: DataSource,
  ) {}

  findByProduct(productId: string) {
    return this.recipesRepo.find({
      where: { productId },
      relations: { ingredient: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Reemplaza la receta entera del producto.
   *
   * Va en transacción porque son un borrado y una inserción: si el proceso muere en medio sin
   * ella, el producto se queda **sin receta**, que es un estado silencioso —deja de descontar
   * y nadie se entera— en lugar de un error visible.
   */
  async setForProduct(productId: string, dto: SetRecipeDto) {
    const ingredientIds = dto.lines.map((l) => l.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      // El índice único lo rechazaría igual, pero con un error de base de datos. Aquí se
      // puede decir qué pasó.
      throw new BadRequestException('Un ingrediente no puede aparecer dos veces en la receta');
    }

    // La otra mitad de la regla que impide el doble descuento; la primera está en
    // `ProductStockService.ensureMirror`.
    if (dto.lines.length > 0 && (await this.ingredientsRepo.countBy({ productId })) > 0) {
      throw new BadRequestException(
        'Este producto lleva existencias propias. Deja de llevarle stock antes de darle una receta.',
      );
    }

    // Un espejo es un producto vendible, no un insumo. Meterlo como línea de la receta de otro
    // producto sería «producto compuesto», que no está hecho: hoy solo serviría para crear
    // caminos de descuento que nadie puede seguir en pantalla.
    if (
      ingredientIds.length > 0 &&
      (await this.ingredientsRepo.countBy({ id: In(ingredientIds), productId: Not(IsNull()) })) > 0
    ) {
      throw new BadRequestException(
        'Un producto con existencias propias no puede ser ingrediente de una receta.',
      );
    }

    if (ingredientIds.length > 0) {
      const found = await this.ingredientsRepo.countBy({ id: In(ingredientIds) });
      if (found !== new Set(ingredientIds).size) {
        throw new BadRequestException('Algún ingrediente de la receta no existe');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RecipeIngredient, { productId });
      if (dto.lines.length > 0) {
        await manager.save(
          dto.lines.map((line) =>
            manager.create(RecipeIngredient, {
              productId,
              ingredientId: line.ingredientId,
              quantity: line.quantity,
            }),
          ),
        );
      }
    });

    return this.findByProduct(productId);
  }
}
