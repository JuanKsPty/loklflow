import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class MergeOrdersDto {
  /**
   * Las cuentas que se vacían en la principal.
   *
   * El tope de ocho no es arbitrario: es lo que cabe en una fusión real de un salón —un grupo que
   * junta varias mesas— y evita que una petición mueva cientos de líneas en una sola transacción.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUUID('all', { each: true })
  sourceOrderIds!: string[];
}
