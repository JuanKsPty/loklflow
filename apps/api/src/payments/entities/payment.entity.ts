import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import type { PaymentMethod } from '../payment-method.constants';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ type: 'varchar', length: 20 })
  method!: PaymentMethod;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  amount!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference!: string | null;

  @Column({ name: 'processed_by', type: 'uuid', nullable: true })
  processedBy!: string | null;

  @Index()
  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId!: string | null;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt!: Date;
}
