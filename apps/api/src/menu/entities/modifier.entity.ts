import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ModifierOption } from './modifier-option.entity';
import { Product } from './product.entity';

@Entity('modifiers')
export class Modifier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'is_required', default: false })
  isRequired!: boolean;

  @Column({ name: 'allow_multiple', default: false })
  allowMultiple!: boolean;

  @Column({ name: 'min_selections', type: 'int', default: 0 })
  minSelections!: number;

  @Column({ name: 'max_selections', type: 'int', nullable: true })
  maxSelections!: number | null;

  @OneToMany(() => ModifierOption, (option) => option.modifier, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  options!: ModifierOption[];

  @ManyToMany(() => Product, (product) => product.modifiers)
  products!: Product[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
