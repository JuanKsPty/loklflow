import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CloseShiftDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
