import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin?: string;

  @IsUUID()
  roleId!: string;
}
