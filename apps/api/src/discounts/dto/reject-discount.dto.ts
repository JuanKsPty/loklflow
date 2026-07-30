import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectDiscountDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
