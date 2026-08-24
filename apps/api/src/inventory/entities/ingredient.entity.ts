import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import type { IngredientUnit } from '../inventory.constants';

@Entity('ingredients')
/**
 * Los dos índices se declaran aquí además de en la migración para que `synchronize` en desarrollo
 * no los vea como diferencia. TypeORM compara nombre, unicidad y columnas —**no compara el
 * `WHERE`**—, así que basta con que coincidan en lo demás.
 */
@Index('UQ_ingredients_name', ['name'], { unique: true, where: 'product_id IS NULL' })
@Index('UQ_ingredients_product_id', ['productId'], { unique: true })
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Sin `unique: true`, y no es un olvido: la unicidad pasó a ser **parcial** —solo entre los
   * insumos del catálogo, `WHERE product_id IS NULL`— y vive en el índice de arriba. Devolverlo
   * aquí haría que `synchronize` recreara en desarrollo la restricción global que la migración
   * quitó, y el fallo aparecería solo en la máquina de quien programa.
   */
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  /**
   * El producto del que este ingrediente **es** las existencias, o `null`.
   *
   * Con valor, la fila deja de ser un insumo y pasa a ser el contador de un producto vendible:
   * vender tres unidades resta tres, sin receta de por medio. Es el caso del abarrote —una botella,
   * una bolsa— y el único que puede mantener al día quien lleva el negocio desde el teléfono. Sin
   * valor, es lo de siempre —harina, aceite— y se descuenta por `recipe_ingredients`.
   *
   * **Sin `@ManyToOne`, a propósito.** `recipe_ingredients.product_id` ya sigue este patrón: la
   * columna y la clave ajena viven en la migración, y la entidad de inventario no importa
   * `Product`. Es lo que mantiene el módulo sin saber nada del catálogo, y por tanto lo que permite
   * que `InventoryModule` no dependa de `MenuModule`.
   */
  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ type: 'enum', enum: ['kg', 'g', 'l', 'ml', 'units', 'portions'] })
  unit!: IngredientUnit;

  /**
   * El stock **puede quedar negativo**, y es deliberado.
   *
   * No se puede reservar existencias sin servidor, así que bloquear una venta por falta de
   * stock convertiría un dato de gestión en un freno de caja: el cliente ya se comió el plato
   * cuando el sistema se entera de que el número no cuadraba. Un negativo es una señal de que
   * hay que hacer un recuento, no un error que deba detener el cobro.
   */
  @Column({
    name: 'current_stock',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
    transformer: DecimalTransformer,
  })
  currentStock!: number;

  @Column({
    name: 'minimum_stock',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
    transformer: DecimalTransformer,
  })
  minimumStock!: number;

  @Column({
    name: 'cost_per_unit',
    type: 'numeric',
    precision: 10,
    scale: 4,
    default: 0,
    transformer: DecimalTransformer,
  })
  costPerUnit!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
