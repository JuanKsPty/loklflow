import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Combo } from './combo.entity';
import { Product } from './product.entity';

@Entity('combo_items')
export class ComboItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Combo, (combo) => combo.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'combo_id' })
  combo!: Combo;

  @Column({ name: 'combo_id', type: 'uuid' })
  comboId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ name: 'allow_substitution', default: false })
  allowSubstitution!: boolean;
}
