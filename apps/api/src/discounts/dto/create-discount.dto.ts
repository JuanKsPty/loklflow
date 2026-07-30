import { IsIn, IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { DISCOUNT_TYPES, type DiscountType } from '../discount.constants';

export class CreateDiscountDto {
  @IsIn(DISCOUNT_TYPES)
  type!: DiscountType;

  /** Porcentaje (0-100) si type es 'percentage'; importe en moneda si es 'fixed'. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason!: string;
}
