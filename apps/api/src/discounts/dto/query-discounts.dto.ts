import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { DISCOUNT_STATUSES, type DiscountStatus } from '../discount.constants';

export const DISCOUNT_MAX_LIMIT = 100;

export class QueryDiscountsDto {
  @IsOptional()
  @IsIn(DISCOUNT_STATUSES)
  status?: DiscountStatus;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DISCOUNT_MAX_LIMIT)
  limit?: number = 50;
}
