import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ORDER_SOURCES, type OrderSource } from '../order-status.constants';

export class CreateOrderItemDto {
  /**
   * uuid generado en el dispositivo. Opcional: el POS conectado no lo manda y el servidor
   * genera uno. Sirve para que una línea añadida sin conexión conserve su identidad al
   * sincronizar, y para que reenviar la operación no la duplique.
   */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  modifierOptionIds?: string[];

  /**
   * Hora a la que la línea se añadió de verdad en el salón. La pone la cola sin conexión al
   * reenviar (`withOccurredAt`), y para `order.addItem` **el ítem es el cuerpo de la
   * petición**, así que el campo tiene que estar aquí y no solo en `CreateOrderDto`.
   *
   * Anidada dentro de `CreateOrderDto.items` no se usa para nada, pero se acepta: el pipe
   * global corre con `forbidNonWhitelisted`, así que un campo no declarado devolvería 400 y
   * la cola trataría ese 400 como definitivo. Perderíamos la comanda por un sello de hora.
   */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

export class CreateOrderDto {
  /**
   * uuid generado en el dispositivo, que pasa a ser la clave primaria de la orden.
   *
   * Permite abrir una cuenta sin conexión y encolar operaciones contra ella —añadir ítems,
   * cambiar el estado, cobrar— antes de que el servidor la conozca, sin que la cola tenga
   * que reescribir identificadores al sincronizar. Y hace la creación idempotente: reenviar
   * la misma petición devuelve la orden existente en lugar de crear una segunda.
   *
   * Opcional para no romper al POS conectado, que deja que el servidor lo genere.
   */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsIn(ORDER_SOURCES)
  source?: OrderSource;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Hora a la que se abrió la cuenta en el salón, no aquella en que el servidor se entera.
   * Se guarda en `orders.occurred_at` tras pasar por `saneOccurredAt`, que descarta relojes
   * imposibles en vez de rechazar la comanda.
   */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
