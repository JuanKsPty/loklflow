import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OpenShiftDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
