import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { TABLE_STATUSES, type TableStatus } from '../status.constants';

export class CreateTableDto {
  @IsInt()
  @Min(1)
  number!: number;

  @IsUUID()
  sectorId!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsIn(TABLE_STATUSES)
  status?: TableStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
