import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { INGREDIENT_UNITS, type IngredientUnit } from '../inventory.constants';

export class CreateIngredientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsIn(INGREDIENT_UNITS)
  unit!: IngredientUnit;

  /**
   * Stock inicial. No se escribe directo en la columna: el servicio lo registra como un
   * movimiento de tipo `adjustment`, para que el historial explique de dónde salió el número
   * con el que arranca el ingrediente.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  initialStock?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
