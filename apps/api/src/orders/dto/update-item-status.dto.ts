import { IsIn } from 'class-validator';
import { ORDER_ITEM_STATUSES, type OrderItemStatus } from '../order-status.constants';

export class UpdateItemStatusDto {
  @IsIn(ORDER_ITEM_STATUSES)
  status!: OrderItemStatus;
}
