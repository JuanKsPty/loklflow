import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PAYMENT_METHODS, type PaymentMethod } from '../payment-method.constants';

export class QuickSaleItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class QuickSalePaymentDto {
  @IsIn(PAYMENT_METHODS)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class QuickSaleDto {
  /**
   * **Obligatorio**, a diferencia de `POST /orders`, donde es opcional.
   *
   * Es lo único que hace la operación reintentable: sin él, un teléfono con datos flojos que
   * reenvía por su cuenta cobra dos veces, descuenta dos veces y deja dos cuentas. La clave de
   * idempotencia del pago se deriva de este mismo id, así que no puede quedarse a medias.
   */
  @IsUUID()
  id!: string;

  /** Por si el dispositivo quiere su propia clave para el cobro. Si no, se deriva del `id`. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRequestId?: string;

  /** Por defecto «Mostrador». Sirve para distinguir dos cajas, o una barra de un mostrador. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuickSaleItemDto)
  items!: QuickSaleItemDto[];

  /**
   * **Sin `amount`**, y es la decisión más importante del endpoint: el importe lo calcula el
   * servidor con el precio actual del catálogo. Si la pantalla se pintó con un precio viejo,
   * cobrar lo que dice el teléfono deja la cuenta descuadrada contra el arqueo.
   */
  @ValidateNested()
  @Type(() => QuickSalePaymentDto)
  payment!: QuickSalePaymentDto;
}
