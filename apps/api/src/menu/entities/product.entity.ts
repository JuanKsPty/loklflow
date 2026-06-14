import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Modifier } from './modifier.entity';
import { ProductAvailability } from './product-availability.entity';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import type { PreparationStation } from '../preparation-station.constants';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  price!: number;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @ManyToOne(() => Category, (category) => category.products, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category!: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'kitchen' })
  station!: PreparationStation;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @ManyToMany(() => Modifier, (modifier) => modifier.products)
  @JoinTable({
    name: 'product_modifiers',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'modifier_id', referencedColumnName: 'id' },
  })
  modifiers!: Modifier[];

  @OneToMany(() => ProductAvailability, (availability) => availability.product, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  availabilities!: ProductAvailability[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
