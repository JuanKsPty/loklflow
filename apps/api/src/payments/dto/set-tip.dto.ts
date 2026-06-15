import { IsNumber, Min } from 'class-validator';

export class SetTipDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tipAmount!: number;
}
