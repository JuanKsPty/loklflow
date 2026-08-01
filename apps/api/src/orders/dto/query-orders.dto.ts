import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.constants';

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
}
