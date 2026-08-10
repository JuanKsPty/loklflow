import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import type { IngredientUnit } from '../inventory.constants';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  name!: string;

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
