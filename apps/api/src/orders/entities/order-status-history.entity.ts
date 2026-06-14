import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, (order) => order.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 20, nullable: true })
  fromStatus!: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus!: string;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy!: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes!: string | null;
}
