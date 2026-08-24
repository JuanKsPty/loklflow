import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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
// Ejes de agregación del dashboard y de los reportes: sin estos índices, cualquier
// consulta por rango de fechas o por turno hace un recorrido completo de la tabla.
@Index('idx_orders_created_at', ['createdAt'])
@Index('idx_orders_shift_id', ['shiftId'])
@Index('idx_orders_waiter_id', ['waiterId'])
@Index('idx_orders_status', ['status'])
// Todas las consultas operativas filtran por esta columna desde que existe la fusión: sin índice,
// cada listado del salón recorre la tabla entera.
@Index('idx_orders_merged_into', ['mergedIntoOrderId'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * El valor lo pide el servicio a la secuencia `orders_order_number_seq` (ver
   * `OrdersService.nextOrderNumber`), no un `MAX(order_number) + 1`, que se pisaba con dos
   * peticiones simultáneas.
   *
   * La columna se declara limpia, sin `default`: la secuencia es un objeto que TypeORM no
   * conoce. Poner el default aquí y en la columna hacía que `synchronize` lo detectara como
   * diferencia y rompiera el arranque en desarrollo.
   *
   * Consecuencia asumida para el modo sin conexión: el dispositivo no conoce el número hasta
   * que el servidor confirma la orden, así que mientras esté pendiente de sincronizar la
   * interfaz muestra la mesa o la etiqueta en su lugar.
   */
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

  @Column({ type: 'enum', enum: ['staff', 'customer_qr', 'counter'], default: 'staff' })
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

  /**
   * La cuenta en la que esta se fusionó, o `null`.
   *
   * Vivió como columna suelta desde el esquema inicial —sin clave ajena, sin índice y sin que
   * ninguna consulta la leyera— hasta que se implementó la fusión.
   *
   * **El `status` de una cuenta fusionada no se toca**, y esa es la decisión no obvia: no se pone
   * `closed` (sería mentira: no se cobró) ni `cancelled` (ensuciaría la auditoría de cancelaciones
   * y los reportes). La exclusión de los listados y de los agregados cuelga de esta columna, y con
   * cero ítems sus totales quedan en 0. Así la fusión es completamente reversible sin haber
   * falsificado ninguna transición.
   */
  @ManyToOne(() => Order, (order) => order.mergedOrders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'merged_into_order_id' })
  mergedInto!: Order | null;

  @Column({ name: 'merged_into_order_id', type: 'uuid', nullable: true })
  mergedIntoOrderId!: string | null;

  /** Las cuentas que se fusionaron en esta. */
  @OneToMany(() => Order, (order) => order.mergedInto)
  mergedOrders!: Order[];

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (h) => h.order, { cascade: true })
  statusHistory!: OrderStatusHistory[];

  @OneToMany(() => Payment, (p) => p.order)
  payments!: Payment[];

  /**
   * Hora a la que se abrió la cuenta en el salón, cuando el dispositivo la reporta.
   *
   * Es una columna **aparte** de `created_at`, no un reemplazo: un `@CreateDateColumn`
   * peleando con un valor asignado a mano es comportamiento indocumentado, y el rastro debe
   * conservar los dos hechos —cuándo pasó y cuándo nos enteramos—, que es justo la diferencia
   * que interesa cuando se investiga un corte de red.
   *
   * `null` en todo lo creado en línea, que es la inmensa mayoría: quien la lea debe hacerlo
   * como `occurredAt ?? createdAt`.
   */
  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
