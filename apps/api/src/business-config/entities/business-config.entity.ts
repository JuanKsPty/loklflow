import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';

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

  @Column({ type: 'varchar', nullable: true, name: 'email' })
  email!: string | null;

  /** Identificación fiscal del negocio (RFC, NIT, RUC…) para el recibo. */
  @Column({ type: 'varchar', nullable: true, name: 'tax_id' })
  taxId!: string | null;

  /**
   * Tasa de impuesto en porcentaje, **ya incluida en los precios del menú**.
   * El recibo la desglosa de forma informativa (total × tasa / (1 + tasa)); el cálculo
   * de totales no la usa, porque el precio del producto es el final.
   */
  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  taxRate!: number;

  /** Pie del recibo: agradecimiento, política de devoluciones, etc. */
  @Column({ type: 'varchar', nullable: true, length: 255, name: 'receipt_footer' })
  receiptFooter!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
