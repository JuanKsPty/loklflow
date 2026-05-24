import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', name: 'user_name', nullable: true })
  userName!: string | null;

  @Column()
  action!: string;

  @Column({ type: 'varchar', nullable: true, name: 'entity_type' })
  entityType!: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'entity_id' })
  entityId!: string | null;

  @Column({ nullable: true, type: 'jsonb', name: 'old_value' })
  oldValue!: Record<string, unknown> | null;

  @Column({ nullable: true, type: 'jsonb', name: 'new_value' })
  newValue!: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true, name: 'ip_address' })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
