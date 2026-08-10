import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthThrottlerGuard } from './auth-throttler.guard';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller('auth')
/**
 * El límite de peticiones se aplica **aquí y en ningún otro sitio**: estas son las únicas rutas
 * donde hay algo que adivinar. El motivo de que no sea global está en `AuthThrottlerGuard`.
 */
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  // Diez por minuto y por (IP, email). Un humano que se equivoca no llega a diez; un script que
  // recorre un diccionario, sí.
  @Throttle({ sesion: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    return this.authService.login(dto, res, ip);
  }

  @Public()
  /**
   * El caso más expuesto de la aplicación: un PIN de cuatro dígitos son 10 000 combinaciones, y
   * `GET /users/operational` es público, así que quien esté en la WiFi del local ya tiene la
   * lista de a quién intentar. Diez por minuto convierte un recorrido completo en más de un día,
   * y el bloqueo por intentos fallidos del bloque de seguridad lo cierra del todo.
   */
  @Throttle({ sesion: { ttl: 60_000, limit: 10 } })
  @Post('pin')
  @HttpCode(HttpStatus.OK)
  pinLogin(
    @Body() dto: PinLoginDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    return this.authService.pinLogin(dto, res, ip);
  }

  @Public()
  /**
   * Holgado a propósito. `apiFetch` llama aquí ante **cada** 401, y al caducar un token con
   * varias pantallas abiertas llegan varios refrescos a la vez; estrecharlo expulsaría al
   * operario a `/login`, que es el formulario de email donde un mesero no tiene credenciales.
   */
  @Throttle({ sesion: { ttl: 60_000, limit: 30 } })
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @CurrentUser() user: JwtPayload & { refreshToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // El método de login viaja en el payload del token de refresco: sin propagarlo, una
    // sesión por PIN se convertiría en una de email al primer refresco.
    return this.authService.refresh(user.sub, user.refreshToken, res, user.loginMethod);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    return this.authService.logout(user.sub, res, ip);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user);
  }
}
