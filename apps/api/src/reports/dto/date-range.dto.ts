import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Rango de fechas de un reporte. Ambos extremos son opcionales; sin ellos, los
 * servicios usan el día de hoy.
 *
 * Nota conocida: las agregaciones por día usan la zona horaria del servidor, no la de
 * `business_config.timezone`. Está fuera de alcance por ahora y anotado en el ROADMAP.
 */
export class DateRangeDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
