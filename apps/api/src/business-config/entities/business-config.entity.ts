import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('business_config')
export class BusinessConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'business_name' })
  businessName!: string;

  @Column({ type: 'varchar', nullable: true, name: 'logo_url' })
  logoUrl!: string | null;

  @Column({ default: 'America/Mexico_City' })
  timezone!: string;

  @Column({ type: 'varchar', nullable: true, name: 'phone' })
  phone!: string | null;

  @Column({ nullable: true, name: 'address', type: 'text' })
  address!: string | null;

  @Column({ name: 'currency', default: 'MXN', length: 3 })
  currency!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
