import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Lo que un cliente puede mandar desde su teléfono.
 *
 * **DTO propio y no `CreateOrderDto`.** Lo que se deja fuera es la mitad del trabajo:
 *
 * - **`id`** — que un desconocido elija la clave primaria de una orden es una primitiva de sondeo
 *   («¿existe esta?») y de sobrescritura. Existe para la cola sin conexión, y un teléfono ajeno no
 *   tiene cola.
 * - **`tableId`** — sale del `qrCode` de la ruta. Aceptarlo permitiría pedir a nombre de otra mesa.
 * - **`source`** — el servidor fuerza `customer_qr`. Un cliente no puede hacerse pasar por
 *   personal.
 * - **`label`** — se deriva de `customerName`, así el nombre acaba donde el mesero lo espera.
 *
 * `forbidNonWhitelisted` del pipe global convierte cualquiera de esos campos en un 400, así que la
 * omisión no es documental: es aplicada.
 */
export class PublicOrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  /**
   * El tope es lo que impide una denegación de servicio a la cocina.
   *
   * Un `{ quantity: 999999 }` sobre un producto real no lo atrapa ningún límite de peticiones: es
   * **una** petición perfectamente formada que manda a la plancha mil kilos de carne y descuadra
   * el inventario. Veinte de una línea cubre cualquier mesa grande.
   */
  @Max(20)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  modifierOptionIds?: string[];
}

export class PublicCreateOrderDto {
  /** Para que el mesero sepa a quién lleva la comanda. Acaba en `orders.label`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  // Mismo razonamiento que el tope de cantidad, aplicado al número de líneas.
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => PublicOrderItemDto)
  items!: PublicOrderItemDto[];
}
