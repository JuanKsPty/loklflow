import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import {
  TABLE_STATUSES,
  type TableStatus,
  TABLE_SHAPES,
  type TableShape,
} from '../status.constants';

/**
 * **No hay `qrCode` aquí a propósito.** `UpdateTableDto` es un `PartialType` de esta clase, así
 * que declararlo permitiría a cualquier cliente con `tables:update` escoger el token del QR de
 * una mesa —y por tanto adivinar o reutilizar el de otra. El token lo genera el servidor al
 * crear la mesa y solo se cambia por `POST /tables/:id/qr/rotate`.
 */
export class CreateTableDto {
  // Opcional: si no se envía, el backend asigna el siguiente número disponible.
  @IsOptional()
  @IsInt()
  @Min(1)
  number?: number;

  @IsUUID()
  sectorId!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsIn(TABLE_STATUSES)
  status?: TableStatus;

  @IsOptional()
  @IsIn(TABLE_SHAPES)
  shape?: TableShape;

  @IsOptional()
  @IsInt()
  positionX?: number;

  @IsOptional()
  @IsInt()
  positionY?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
