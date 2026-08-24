import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { STOCK_SET_REASONS, type StockSetReason } from '../inventory.constants';

/**
 * «Ahora tengo N.»
 *
 * Lo que se manda es el stock **absoluto**, no el delta: es lo que sabe quien acaba de contar, y
 * pedirle que reste él es pedirle que se equivoque. El delta lo calcula el servidor con la fila
 * bloqueada; ver `StockService.apply`.
 */
export class SetStockDto {
  /**
   * Se aceptan negativos. El stock puede quedar negativo a propósito (ver `ingredient.entity.ts`),
   * y si el operario cuenta y ve que debe unidades, el sistema tiene que poder decirlo en vez de
   * obligarle a mentir con un cero.
   */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(-999_999_999)
  @Max(999_999_999)
  newStock!: number;

  /** Vocabulario cerrado: tres botones, cero escritura. La regla del motivo se cumple igual. */
  @IsIn(STOCK_SET_REASONS)
  reasonCode!: StockSetReason;

  /** Opcional; se pega detrás de la etiqueta del motivo. */
  @IsOptional()
  @IsString()
  @MaxLength(180)
  note?: string;
}
