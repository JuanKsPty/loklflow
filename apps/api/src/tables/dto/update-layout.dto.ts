import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { TABLE_SHAPES, type TableShape } from '../status.constants';

export class LayoutPositionDto {
  @IsUUID()
  id!: string;

  @IsInt()
  positionX!: number;

  @IsInt()
  positionY!: number;

  @IsOptional()
  @IsIn(TABLE_SHAPES)
  shape?: TableShape;
}

export class UpdateLayoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LayoutPositionDto)
  positions!: LayoutPositionDto[];
}
