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

  /**
   * Clave de idempotencia del dispositivo: reenviar el mismo pago devuelve el estado de la
   * cuenta sin volver a cobrar. Imprescindible para la cola de sincronización, y útil ya
   * hoy contra el doble clic en un pago parcial.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRequestId?: string;
}
