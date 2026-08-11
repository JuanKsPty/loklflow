import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IsAcceptablePin } from '../is-acceptable-pin.validator';

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
  // El formato **y** la calidad: `checkPin` rechaza además lo repetido, las secuencias y los PINs
  // que la gente elige de verdad. Contra esos, el bloqueo por intentos no ayuda — a quien los
  // prueba no le hace falta insistir.
  @IsAcceptablePin()
  pin?: string;

  @IsUUID()
  roleId!: string;
}
