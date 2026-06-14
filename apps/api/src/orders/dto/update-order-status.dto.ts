import { IsIn, IsOptional, IsString } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.constants';

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
