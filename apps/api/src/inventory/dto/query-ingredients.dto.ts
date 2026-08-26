import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { SearchQueryDto } from '../../common/dto/search-query.dto';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

/**
 * `lowStock` existía ya, pero como un `@Query('lowStock')` suelto en el controlador. Pasarlo a un
 * DTO lo mete bajo el `ValidationPipe`, y eso tiene un efecto que conviene decir en voz alta:
 * **la ruta se vuelve estricta**. Hasta ahora `?loQueSea=1` se ignoraba en silencio aquí; a partir
 * de ahora devuelve 400, como en el resto de listados que ya llevaban DTO.
 */
export class QueryIngredientsDto extends SearchQueryDto {
  /** Los que están en el mínimo o por debajo. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  lowStock?: boolean;
}
