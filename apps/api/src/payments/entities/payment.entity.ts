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
// Índice con nombre explícito para que coincida con el de la migración: si se dejara a
// `unique: true` en la columna, `synchronize` lo crearía con otro nombre y en desarrollo
// aparecería como una diferencia permanente del esquema.
@Index('idx_payments_client_request_id', ['clientRequestId'], { unique: true })
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

  /**
   * Clave de idempotencia que genera el dispositivo. Nula en los cobros hechos desde el POS
   * conectado, y en Postgres varios nulos no chocan en un índice único.
   *
   * A diferencia de las órdenes, un pago no necesita que su id lo ponga el cliente —nada lo
   * referencia después—; solo necesita no duplicarse. Sin esto, reenviar un pago parcial
   * cobra dos veces: el importe cabe en lo que resta, así que ninguna validación lo frena.
   */
  @Column({ name: 'client_request_id', type: 'varchar', length: 64, nullable: true })
  clientRequestId!: string | null;

  @Column({ name: 'processed_by', type: 'uuid', nullable: true })
  processedBy!: string | null;

  @Index()
  @Column({ name: 'shift_id', type: 'uuid', nullable: true })
  shiftId!: string | null;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt!: Date;
}
