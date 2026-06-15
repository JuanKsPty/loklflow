import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PAYMENT_METHODS, type PaymentMethod } from '../payment-method.constants';

export class CreatePaymentDto {
  @IsIn(PAYMENT_METHODS)
  method!: PaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
