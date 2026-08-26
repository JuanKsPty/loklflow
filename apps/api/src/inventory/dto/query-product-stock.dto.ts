import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { SearchQueryDto } from '../../common/dto/search-query.dto';
import { SEARCH_MAX_LENGTH, toSearchTerm } from '../../common/search';

/**
 * Filtros de la lista de existencias por producto.
 *
 * Van en un DTO y no como `@Query('x') x?: string` sueltos porque el `ValidationPipe` global corre
 * con `forbidNonWhitelisted`: un parámetro no declarado devuelve 400.
 */
const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

export class QueryProductStockDto extends SearchQueryDto {
  /**
   * La categoría por **nombre**, igual que en `/menu/products`: `?category=Bebidas`.
   *
   * Aquí sale gratis: `categories` ya está unida a la consulta y `c.name` ya se selecciona para
   * pintar la columna «Categoría» — el nombre llevaba tiempo en pantalla sin poder filtrar por él.
   */
  @IsOptional()
  @Transform(toSearchTerm)
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  category?: string;

  /** Los que están en el mínimo o por debajo, **y también los que están en negativo**. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  lowStock?: boolean;

  /** `true`: solo los que llevan existencias. `false`: solo los que aún no. Sin él, todos. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  tracked?: boolean;

  /** Por defecto no salen: un producto que no se puede vender es ruido en la pantalla de stock. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeInactive?: boolean;
}
