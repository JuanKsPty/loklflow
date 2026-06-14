import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { OrderItemStatus } from '../order-status.constants';
import { Product } from '../../menu/entities/product.entity';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import { Order } from './order.entity';
import { OrderItemModifier } from './order-item-modifier.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Product, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  subtotal!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending',
  })
  status!: OrderItemStatus;

  @OneToMany(() => OrderItemModifier, (m) => m.orderItem, {
    cascade: true,
    orphanedRowAction: 'delete',
    eager: true,
  })
  modifiers!: OrderItemModifier[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
