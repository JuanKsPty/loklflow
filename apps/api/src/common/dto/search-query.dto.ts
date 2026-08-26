import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SEARCH_MAX_LENGTH, toSearchTerm } from '../search';

/**
 * El filtro de texto que comparten todos los listados del panel.
 *
 * Va en una clase y no como `@Query('q') q?: string` suelto porque el `ValidationPipe` global
 * corre con `forbidNonWhitelisted` (`main.ts:72-74`): un parámetro no declarado devuelve 400. Es
 * la misma razón que explica `QueryProductStockDto`, y es lo que obliga a que cada endpoint de
 * listado tenga su DTO aunque solo acepte este campo.
 *
 * Los DTOs concretos heredan de aquí con `extends` y añaden lo suyo.
 */
export class SearchQueryDto {
  /** Busca por nombre, sin distinguir mayúsculas ni acentos. Vacío significa «sin filtro». */
  @IsOptional()
  @Transform(toSearchTerm)
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  q?: string;
}
