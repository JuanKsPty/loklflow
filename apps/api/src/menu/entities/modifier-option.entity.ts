import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Modifier } from './modifier.entity';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';

@Entity('modifier_options')
export class ModifierOption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Modifier, (modifier) => modifier.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'modifier_id' })
  modifier!: Modifier;

  @Column({ name: 'modifier_id', type: 'uuid' })
  modifierId!: string;

  @Column()
  name!: string;

  @Column({
    name: 'price_adjustment',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  priceAdjustment!: number;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
