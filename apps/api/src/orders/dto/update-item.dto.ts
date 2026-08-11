import { IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class UpdateItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Se acepta y **no se guarda**: no hay ninguna columna donde cambiaría un número, y la
   * corrección de una línea no alimenta ninguna métrica de tiempo. Se declara igualmente
   * porque el pipe global corre con `forbidNonWhitelisted` y la cola sin conexión lo añade
   * a todo lo que reenvía; sin este campo la operación devolvería 400, que la cola clasifica
   * como fallo definitivo, y la corrección acabaría en la bandeja de fallos.
   */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
