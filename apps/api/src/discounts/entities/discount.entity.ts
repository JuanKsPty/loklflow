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
import type { DiscountStatus, DiscountType } from '../discount.constants';

/**
 * Descuento solicitado sobre una cuenta. Sigue el modelo de docs/DATA_MODEL.md.
 *
 * Existe como tabla propia y no como columnas en `orders` porque necesita estado
 * (pending/approved/rejected), un solicitante y un aprobador distintos, y porque la
 * notificación al gerente apunta al descuento por su id. El importe del descuento
 * **aprobado** se refleja además en `orders.discountAmount`, que es lo que consume el
 * cálculo de totales.
 */
@Entity('discounts')
// Los dos ejes de consulta: el historial de una cuenta y la bandeja de pendientes.
@Index('idx_discounts_order_id', ['orderId'])
@Index('idx_discounts_status', ['status'])
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: DiscountType;

  /** Porcentaje si type es 'percentage', importe en moneda si es 'fixed'. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  value!: number;

  /**
   * Importe resuelto en moneda, calculado al solicitar. Se guarda para que el
   * histórico no cambie si luego se añaden o cancelan líneas de la orden.
   */
  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  amount!: number;

  /** Porcentaje equivalente sobre el subtotal al momento de solicitarlo. */
  @Column({
    name: 'percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: DecimalTransformer,
  })
  percentage!: number;

  /** Obligatorio: sin motivo un descuento no es auditable. */
  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string;

  /** Denormalizado para que la bandeja no tenga que resolver el usuario. */
  @Column({ name: 'requested_by_name', type: 'varchar', nullable: true })
  requestedByName!: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_by_name', type: 'varchar', nullable: true })
  approvedByName!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: DiscountStatus;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  /** Motivo del rechazo, cuando lo hay. */
  @Column({ name: 'rejection_reason', type: 'varchar', length: 255, nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
