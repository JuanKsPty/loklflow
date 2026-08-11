import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('order_status_history')
// La tabla no tenía ningún índice y es la base de las métricas de tiempo de preparación.
@Index('idx_osh_order_id', ['orderId'])
@Index('idx_osh_changed_at', ['changedAt'])
@Index('idx_osh_to_status', ['toStatus'])
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

  /**
   * Hora a la que el cambio ocurrió en el salón, cuando el dispositivo la reporta.
   *
   * Es la que da sentido al tiempo de preparación con una cocina sin red: `changed_at` dice
   * cuándo llegó la operación al servidor, y con un corte de veinte minutos esos veinte
   * minutos se sumarían al tiempo de cocina de todas las órdenes del corte.
   *
   * `null` en todo lo registrado en línea. Léase como `occurredAt ?? changedAt`.
   */
  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt!: Date | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes!: string | null;
}
