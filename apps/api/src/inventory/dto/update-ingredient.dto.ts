import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateIngredientDto } from './create-ingredient.dto';

/**
 * `initialStock` se excluye a propósito: el stock **nunca** se edita, se mueve. Dejarlo aquí
 * abriría una vía para cambiar existencias sin dejar movimiento, que es justo lo que el libro
 * mayor existe para impedir. Para corregir se usa POST /inventory/movements con `adjustment`.
 */
export class UpdateIngredientDto extends PartialType(
  OmitType(CreateIngredientDto, ['initialStock'] as const),
) {}
