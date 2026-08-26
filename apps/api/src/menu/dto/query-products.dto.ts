import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { SEARCH_MAX_LENGTH, toSearchTerm } from '../../common/search';

/** Igual que en `QueryProductStockDto`: acepta el booleano venga como venga desde una URL. */
const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

export class QueryProductsDto extends SearchQueryDto {
  /**
   * La categoría por **nombre**, no por uuid.
   *
   * Es lo que hace que la vista filtrada sea una URL que se puede leer y mandar por mensaje
   * (`?categoria=Bebidas`), que es la regla que el panel ya se puso con el filtro de bajo mínimo.
   * Se compara igual que el nombre —sin acentos ni mayúsculas— para que «bebidas» valga.
   *
   * Si dos categorías se llamaran igual saldrían los productos de ambas, que es justo lo que
   * esperaría quien escribió ese nombre.
   */
  @IsOptional()
  @Transform(toSearchTerm)
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  category?: string;

  /**
   * Tri-estado a propósito: sin él salen **todos**, activos e inactivos.
   *
   * El listado del panel es donde se editan los productos dados de baja, así que no puede
   * esconderlos por defecto — hay un test de integración que lo fija («el listado de admin incluye
   * los inactivos»). `true` deja solo los activos y `false` solo los inactivos.
   */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  active?: boolean;
}
