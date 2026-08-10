import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { ORDER_ITEM_STATUSES, type OrderItemStatus } from '../order-status.constants';

export class UpdateItemStatusDto {
  @IsIn(ORDER_ITEM_STATUSES)
  status!: OrderItemStatus;

  /**
   * Se acepta y no se guarda: el estado por línea no tiene tabla de historial, así que no hay
   * dónde ponerlo. Se declara por lo mismo que en `UpdateItemDto` — `forbidNonWhitelisted`
   * convertiría el campo de la cola en un 400 definitivo.
   */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
