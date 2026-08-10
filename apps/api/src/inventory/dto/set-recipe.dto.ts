import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';

export class RecipeLineDto {
  @IsUUID()
  ingredientId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;
}

/**
 * La receta se reemplaza entera, no se parchea línea a línea.
 *
 * Es un `PUT` sobre un conjunto pequeño que siempre se edita completo desde la ficha del
 * producto, y así el cliente no tiene que llevar la cuenta de qué líneas borrar. Enviar una
 * lista vacía deja el producto sin receta, que es un estado válido: no descuenta nada.
 */
export class SetRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines!: RecipeLineDto[];
}
