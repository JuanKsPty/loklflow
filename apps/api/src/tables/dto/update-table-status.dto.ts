import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { TABLE_STATUSES, type TableStatus } from '../status.constants';

export class UpdateTableStatusDto {
  @IsIn(TABLE_STATUSES)
  status!: TableStatus;

  /**
   * Hora del cambio en el salón. Aquí no se guarda: se **compara**.
   *
   * El estado de una mesa es el único dato encolable que dos dispositivos pueden pisarse —el
   * mesero marca «libre» sin red mientras otro la marca «ocupada» desde la caja—, y el orden
   * de llegada no dice nada sobre el orden de los hechos. Si el `occurredAt` que llega es
   * anterior al último cambio de la mesa, la operación se ignora en silencio (200): el hecho
   * que describe ya quedó obsoleto. Se responde 200 y no 400 a propósito, porque nadie debe
   * encontrarse una entrada en la bandeja de fallos por el color de una mesa.
   */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
