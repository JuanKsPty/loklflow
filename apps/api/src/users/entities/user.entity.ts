import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  password!: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  pin!: string | null;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /**
   * Versión de las sesiones de este usuario.
   *
   * Se firma dentro del token y se compara en cada petición: subirla invalida **todas** sus
   * sesiones vivas sin tener que esperar a que caduquen. Sube al desactivar al usuario, al
   * cambiarle el rol y al cambiar los permisos de su rol — los tres casos en los que el token
   * dejaba de reflejar la realidad y seguía valiendo igual.
   *
   * Empieza en 0 para todo el mundo, y un token sin el campo se trata como versión 0: por eso
   * aplicar esto no echa a nadie.
   */
  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
