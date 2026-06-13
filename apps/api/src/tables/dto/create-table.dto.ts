import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import {
  TABLE_STATUSES,
  type TableStatus,
  TABLE_SHAPES,
  type TableShape,
} from '../status.constants';

export class CreateTableDto {
  // Opcional: si no se envía, el backend asigna el siguiente número disponible.
  @IsOptional()
  @IsInt()
  @Min(1)
  number?: number;

  @IsUUID()
  sectorId!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsIn(TABLE_STATUSES)
  status?: TableStatus;

  @IsOptional()
  @IsIn(TABLE_SHAPES)
  shape?: TableShape;

  @IsOptional()
  @IsInt()
  positionX?: number;

  @IsOptional()
  @IsInt()
  positionY?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
