import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import { Ingredient } from './ingredient.entity';

/**
 * Cuánto de un ingrediente lleva **una unidad** de un producto.
 *
 * La receta es opcional: un producto sin ninguna línea no descuenta nada al venderse, y eso
 * no es un error. Un negocio empieza vendiendo sin haber cargado el inventario, y exigir la
 * receta para poder cobrar sería poner el carro delante del caballo.
 */
@Entity('recipe_ingredients')
@Index('UQ_recipe_ingredients_product_ingredient', ['productId', 'ingredientId'], {
  unique: true,
})
export class RecipeIngredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ name: 'ingredient_id', type: 'uuid' })
  ingredientId!: string;

  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient?: Ingredient;

  @Column({ type: 'numeric', precision: 12, scale: 3, transformer: DecimalTransformer })
  quantity!: number;
}
