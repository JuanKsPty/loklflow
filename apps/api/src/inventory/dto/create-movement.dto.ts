import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/**
 * Los tipos que un humano puede registrar a mano. **`consumption` no está**: ese lo escribe
 * solo el cierre de cuenta, con su `order_id`, y dejarlo abierto por API permitiría fabricar
 * consumos sin venta detrás.
 */
export const MANUAL_MOVEMENT_TYPES = ['entry', 'waste', 'adjustment'] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

export class CreateMovementDto {
  @IsUUID()
  ingredientId!: string;

  @IsIn(MANUAL_MOVEMENT_TYPES)
  type!: ManualMovementType;

  /**
   * Siempre **positiva**. El signo lo decide el tipo: `entry` suma, `waste` resta, y
   * `adjustment` usa `direction`. Pedir un número con signo al cliente es cómo se acaba
   * sumando una merma.
   */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  /** Solo para `adjustment`: hacia dónde corrige. Por defecto suma. */
  @IsOptional()
  @IsIn(['increase', 'decrease'])
  direction?: 'increase' | 'decrease';

  /** Obligatorio en merma y ajuste: un movimiento sin motivo no se puede auditar. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  /** Solo tiene sentido en `entry`. */
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  /**
   * Costo unitario de esta compra. Solo en `entry`: actualiza el costo del ingrediente con
   * un promedio ponderado, que es lo que hace que el costo del plato siga a la realidad en
   * lugar de quedarse en el precio de la primera compra.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costPerUnit?: number;
}
