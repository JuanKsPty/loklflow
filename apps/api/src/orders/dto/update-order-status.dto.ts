import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.constants';

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Hora del cambio de estado en el salón. **Esta sí se guarda**, en
   * `order_status_history.occurred_at`: es la que alimenta el tiempo de preparación. Sin
   * ella, una cocina que marca «lista» sin red y sincroniza veinte minutos después aparece
   * en el reporte como si hubiera tardado veinte minutos más.
   */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
