import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TableStatus } from '../status.constants';
import { Sector } from './sector.entity';

@Entity('tables')
@Index(['sectorId', 'number'], { unique: true })
export class RestaurantTable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
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

  @Column({ name: 'qr_code', type: 'varchar', length: 100, unique: true })
  qrCode!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
