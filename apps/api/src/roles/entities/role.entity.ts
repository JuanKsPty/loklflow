import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string | null;

  @Column({ name: 'max_discount_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  maxDiscountPercentage!: number;

  @Column({ name: 'is_system', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => RolePermission, (rp) => rp.role, { cascade: true })
  rolePermissions!: RolePermission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
