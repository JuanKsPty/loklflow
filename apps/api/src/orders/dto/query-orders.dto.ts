import { Transform, Type } from 'class-transformer';
import { SEARCH_MAX_LENGTH, toSearchTerm } from '../../common/search';
import { IsBoolean, IsISO8601, IsIn, IsInt, IsOptional, IsUUID, Max, Min,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ORDER_SOURCES,
  ORDER_STATUSES,
  type OrderSource,
  type OrderStatus,
} from '../order-status.constants';

/** Tope duro del tamaño de página, para que nadie pueda pedir el histórico entero. */
export const ORDERS_MAX_TAKE = 200;
export const ORDERS_DEFAULT_TAKE = 50;

/**
 * Filtros del listado de órdenes.
 *
 * Antes `GET /orders` no aceptaba ni paginación ni filtro de apertura: devolvía **todas** las
 * órdenes de la historia del negocio, cada una con mesa, ítems con producto y modificadores,
 * historial de estados y pagos. Con unos meses de operación eso es una respuesta enorme en
 * cada carga del POS y del salón, y hace imposible cachear el listado en el dispositivo.
 */
export class QueryOrdersDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  /**
   * De dónde vino la cuenta. Sirve para `/admin/orders?source=counter` y para que el tablero de
   * cocina pueda pedir explícitamente lo que le toca.
   */
  @IsOptional()
  @IsIn(ORDER_SOURCES)
  source?: OrderSource;

  /**
   * `true` devuelve solo las cuentas vivas (ni cerradas ni canceladas), que es lo que miran el
   * salón, el POS y el tablero de cocina. Se acepta como texto porque llega en la query string.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  open?: boolean;

  /** Solo las modificadas después de este instante, para sincronizaciones incrementales. */
  @IsOptional()
  @IsISO8601()
  since?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ORDERS_MAX_TAKE)
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  /**
   * El número de orden, como texto y con un «contiene»: teclear «10» ofrece la 10, la 105 y la
   * 210 mientras se decide. Es lo único que identifica una orden a ojo — el uuid no se teclea.
   */
  @IsOptional()
  @Transform(toSearchTerm)
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  q?: string;
}
