import { SearchQueryDto } from '../../common/dto/search-query.dto';

/**
 * Categorías, modificadores y combos solo se filtran por nombre, así que su DTO es el base tal
 * cual. Existe como clase propia —y no se usa `SearchQueryDto` directamente en el controlador—
 * para que añadir un filtro suyo mañana no obligue a tocar los otros dos.
 */
export class QueryCombosDto extends SearchQueryDto {}
