import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { OrderSource, OrderStatus } from '../order-status.constants';
import { RestaurantTable } from '../../tables/entities/table.entity';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_number', type: 'int', unique: true })
  orderNumber!: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label!: string | null;

  @ManyToOne(() => RestaurantTable, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_id' })
  table!: RestaurantTable | null;

  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId!: string | null;

  @Column({ name: 'waiter_id', type: 'uuid', nullable: true })
  waiterId!: string | null;

  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId!: string | null;

  @Column({ type: 'enum', enum: ['staff', 'customer_qr'], default: 'staff' })
  source!: OrderSource;

  @Column({
    type: 'enum',
    enum: ['pending', 'preparing', 'ready', 'delivered', 'closed', 'cancelled'],
    default: 'pending',
  })
  status!: OrderStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  subtotal!: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  discountAmount!: number;

  @Column({
    name: 'tip_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  tipAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  total!: number;

  @Column({ name: 'merged_into_order_id', type: 'uuid', nullable: true })
  mergedIntoOrderId!: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (h) => h.order, { cascade: true })
  statusHistory!: OrderStatusHistory[];

  @OneToMany(() => Payment, (p) => p.order)
  payments!: Payment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
