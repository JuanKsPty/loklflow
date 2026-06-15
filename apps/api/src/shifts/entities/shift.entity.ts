import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';
import type { ShiftStatus } from '../shift-status.constants';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'opened_by', type: 'uuid' })
  openedBy!: string;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy!: string | null;

  @CreateDateColumn({ name: 'opened_at' })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({
    name: 'opening_cash',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  openingCash!: number;

  @Column({
    name: 'closing_cash',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  closingCash!: number | null;

  @Column({
    name: 'total_sales',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  totalSales!: number;

  @Column({ type: 'varchar', length: 10, default: 'open' })
  status!: ShiftStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
