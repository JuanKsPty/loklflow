import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * «Llegó mercancía.»
 *
 * Lo que se manda es **lo que llegó**, no el stock resultante. Es la diferencia con
 * `SetStockDto`, y no es un matiz: una entrada de mercancía la escribe alguien que sabe cuántas
 * cajas trajo el repartidor, no cuántas botellas quedan en total. El servidor la suma sobre la
 * fila bloqueada, así que una venta que se cierre en ese mismo instante **no se pierde**.
 */
export class AddStockEntryDto {
  /**
   * Unidades que llegaron. Siempre positiva: el signo lo pone el tipo `entry`.
   *
   * El tope es el mismo de `SetStockDto`, y el mínimo impide la entrada vacía — «llegaron cero»
   * no es un hecho que merezca una fila en el libro mayor, al revés que un recuento en cero.
   */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999_999_999)
  quantity!: number;

  /**
   * Lo que explica el número en el libro mayor, p. ej. «6 cajas × 24». Se pega detrás de la
   * etiqueta del motivo, igual que la nota de `SetStockDto` y con el mismo límite.
   */
  @IsOptional()
  @IsString()
  @MaxLength(180)
  note?: string;
}
