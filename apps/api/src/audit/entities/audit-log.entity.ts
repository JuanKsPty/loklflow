import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AuditAction, AuditEntityType } from '../audit-actions.constants';

@Entity('audit_logs')
// created_at DESC es el orden por defecto de la bitácora; los otros tres son los
// filtros de la vista de consulta.
@Index('idx_audit_logs_created_at', ['createdAt'])
@Index('idx_audit_logs_user_id', ['userId'])
@Index('idx_audit_logs_action', ['action'])
@Index('idx_audit_logs_entity', ['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Deliberadamente varchar y SIN clave ajena a `users`: una bitácora tiene que
   * sobrevivir al borrado del usuario que registró la acción. No es un descuido.
   */
  @Column({ type: 'varchar', name: 'user_id', nullable: true })
  userId!: string | null;

  /** Nombre en el momento de la acción. Denormalizado por la misma razón que userId. */
  @Column({ type: 'varchar', name: 'user_name', nullable: true })
  userName!: string | null;

  @Column()
  action!: AuditAction;

  @Column({ type: 'varchar', nullable: true, name: 'entity_type' })
  entityType!: AuditEntityType | null;

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
