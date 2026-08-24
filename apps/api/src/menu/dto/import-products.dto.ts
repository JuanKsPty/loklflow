import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PREPARATION_STATIONS, type PreparationStation } from '../preparation-station.constants';

/** Tope de filas por petición. El corte real lo hace el cliente por bytes; esto es el techo duro. */
export const IMPORT_MAX_ROWS = 200;

export class ImportProductRowDto {
  /** La línea del CSV. Se devuelve tal cual para poder decir «línea 34» y no «fila 12 del lote 3». */
  @IsInt()
  @Min(1)
  @Max(100_000)
  line!: number;

  /**
   * 150 y no más: `ingredients.name` es `varchar(150)` y el ingrediente espejo de un producto se
   * llama igual. Rechazarlo aquí con un mensaje legible es mejor que un 500 al crear el espejo.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** El tope superior es el de `decimal(10,2)`: sin él, un teclazo es un overflow de Postgres. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  categoryName?: string;

  @IsOptional()
  @IsIn(PREPARATION_STATIONS)
  station?: PreparationStation;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999_999_999)
  stock?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999_999_999)
  minimumStock?: number;
}

export class ImportProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportProductRowDto)
  rows!: ImportProductRowDto[];

  /** Por defecto `false`: crear categorías es un efecto secundario y se pide explícitamente. */
  @IsOptional()
  @IsBoolean()
  createMissingCategories?: boolean;
}
