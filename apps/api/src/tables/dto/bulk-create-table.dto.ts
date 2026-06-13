import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TABLE_SHAPES, type TableShape } from '../status.constants';

export class BulkCreateTableDto {
  @IsUUID()
  sectorId!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  count!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsIn(TABLE_SHAPES)
  shape?: TableShape;
}
