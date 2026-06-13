import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RESERVATION_STATUSES, type ReservationStatus } from '../status.constants';

export class CreateReservationDto {
  @IsUUID()
  tableId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  customerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  @IsInt()
  @Min(1)
  partySize!: number;

  @IsDateString()
  reservedAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(RESERVATION_STATUSES)
  status?: ReservationStatus;
}
