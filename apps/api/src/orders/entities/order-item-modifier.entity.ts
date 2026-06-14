import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ModifierOption } from '../../menu/entities/modifier-option.entity';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import { OrderItem } from './order-item.entity';

@Entity('order_item_modifiers')
export class OrderItemModifier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OrderItem, (item) => item.modifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: OrderItem;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId!: string;

  @ManyToOne(() => ModifierOption, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'modifier_option_id' })
  modifierOption!: ModifierOption;

  @Column({ name: 'modifier_option_id', type: 'uuid' })
  modifierOptionId!: string;

  @Column({
    name: 'price_adjustment',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  priceAdjustment!: number;
}
