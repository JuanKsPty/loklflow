import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Lo que ya aplicaba el servicio calladamente; ahora es el contrato y se puede pedir menos. */
export const MOVEMENTS_DEFAULT_TAKE = 100;
export const MOVEMENTS_MAX_TAKE = 500;

/**
 * El historial del libro mayor.
 *
 * `ingredientId` es un uuid y seguirá siéndolo: es una clave ajena, no algo que nadie teclee. Lo
 * que cambia es quién lo escribe — antes había que pegarlo a mano en la URL porque la pantalla no
 * ofrecía forma de elegir; ahora lo pone un desplegable con los nombres. Se valida como uuid para
 * que un valor inventado dé 400 y no un 500 de conversión en Postgres.
 */
export class QueryMovementsDto {
  @IsOptional()
  @IsUUID()
  ingredientId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MOVEMENTS_MAX_TAKE)
  take?: number;
}
