import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TableStatus, TableShape } from '../status.constants';
import { Sector } from './sector.entity';

@Entity('tables')
export class RestaurantTable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Número de mesa único en todo el negocio.
  @Column({ type: 'int', unique: true })
  number!: number;

  @ManyToOne(() => Sector, (sector) => sector.tables, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sector_id' })
  sector!: Sector;

  @Column({ name: 'sector_id', type: 'uuid' })
  sectorId!: string;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({
    type: 'enum',
    enum: ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'],
    default: 'available',
  })
  status!: TableStatus;

  @Column({
    type: 'enum',
    enum: ['square', 'round'],
    default: 'square',
  })
  shape!: TableShape;

  @Column({ name: 'position_x', type: 'int', nullable: true })
  positionX!: number | null;

  @Column({ name: 'position_y', type: 'int', nullable: true })
  positionY!: number | null;

  @Column({ name: 'qr_code', type: 'varchar', length: 100, unique: true })
  qrCode!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
