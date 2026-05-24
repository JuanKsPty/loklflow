import { IsString, IsUUID, Matches } from 'class-validator';

export class PinLoginDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin!: string;
}
