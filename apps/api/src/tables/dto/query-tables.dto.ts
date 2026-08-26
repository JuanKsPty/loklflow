import { IsOptional, IsUUID } from 'class-validator';
import { SearchQueryDto } from '../../common/dto/search-query.dto';

/** En una mesa, `q` es su número: no tiene nombre. Ver `matchesNumberText`. */
export class QueryTablesDto extends SearchQueryDto {
  @IsOptional()
  @IsUUID()
  sectorId?: string;
}
