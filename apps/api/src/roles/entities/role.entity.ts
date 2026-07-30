import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string | null;

  /**
   * Umbral de descuento que el rol puede autorizar sin aprobación, en porcentaje.
   * Lleva DecimalTransformer como el resto de las columnas de importe: sin él TypeORM
   * devuelve el string "50.00" mientras el tipo declara `number`, y comparar el
   * porcentaje pedido contra el umbral solo funcionaba por coacción de JS.
   */
  @Column({
    name: 'max_discount_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
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
