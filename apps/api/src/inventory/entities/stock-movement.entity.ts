import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import { Ingredient } from './ingredient.entity';
import { Supplier } from './supplier.entity';
import type { StockMovementType } from '../inventory.constants';

/**
 * El libro mayor del inventario. **Append-only**: nunca se edita ni se borra una fila.
 *
 * El índice único parcial es la pieza que impide descontar dos veces por la misma orden. A un
 * cierre de cuenta se puede llegar dos veces —dos pagos concurrentes que la saldan, o una
 * operación reenviada desde la cola sin conexión de la Fase 4— y sin él el segundo cierre
 * vuelve a restar. Va en la entidad además de en la migración para que `synchronize` en
 * desarrollo no vea una diferencia e intente recrearlo.
 */
@Entity('stock_movements')
@Index(
  'idx_stock_movements_one_consumption_per_order_ingredient',
  ['orderId', 'ingredientId'],
  { unique: true, where: "type = 'consumption'" },
)
@Index('IDX_stock_movements_ingredient_created', ['ingredientId', 'createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ingredient_id', type: 'uuid' })
  ingredientId!: string;

  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient?: Ingredient;

  @Column({ type: 'enum', enum: ['entry', 'consumption', 'waste', 'adjustment'] })
  type!: StockMovementType;

  /** Positivo suma, negativo resta. El signo lo pone el servicio según el tipo. */
  @Column({ type: 'numeric', precision: 12, scale: 3, transformer: DecimalTransformer })
  quantity!: number;

  @Column({
    name: 'previous_stock',
    type: 'numeric',
    precision: 12,
    scale: 3,
    transformer: DecimalTransformer,
  })
  previousStock!: number;

  @Column({
    name: 'new_stock',
    type: 'numeric',
    precision: 12,
    scale: 3,
    transformer: DecimalTransformer,
  })
  newStock!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId!: string | null;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Supplier | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
