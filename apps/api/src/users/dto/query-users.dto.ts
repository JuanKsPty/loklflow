import { IsOptional, IsUUID } from 'class-validator';
import { SearchQueryDto } from '../../common/dto/search-query.dto';

export class QueryUsersDto extends SearchQueryDto {
  /**
   * El rol sí viaja por uuid y no por nombre, al revés que la categoría de un producto.
   *
   * El motivo es de dónde sale el valor: la categoría se teclea y se comparte en una URL, mientras
   * que el rol se elige siempre de un desplegable corto y cerrado. Un nombre aquí no añadiría nada
   * legible y sí abriría la puerta a que «Mesero» y «mesero» fueran cosas distintas.
   */
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
