import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ReservationStatus } from '@loklflow/types';
import { RestaurantTable } from './table.entity';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => RestaurantTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table!: RestaurantTable;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId!: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 20, nullable: true })
  customerPhone!: string | null;

  @Column({ name: 'party_size', type: 'int' })
  partySize!: number;

  @Column({ name: 'reserved_at', type: 'timestamptz' })
  reservedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'],
    default: 'pending',
  })
  status!: ReservationStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
