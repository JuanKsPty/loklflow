import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserResponse } from './dto/user-response.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { QueryUsersDto } from './dto/query-users.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * El mapeo a `UserResponse` vive aquí y no en el service a propósito: `findOne` lo consumen
   * `update`, `remove` y `AuthService.refresh`, y los tres necesitan la **entidad** (mutan el
   * usuario cargado o leen `user.role.name`). Aplanar en el service obligaría a mantener dos
   * variantes de cada lectura; el borde HTTP es el único sitio donde la forma tiene que cambiar.
   */
  @Get()
  @RequirePermissions('users:read')
  async findAll(@Query() query: QueryUsersDto) {
    return (await this.usersService.findAll(query)).map(toUserResponse);
  }

  @Get('operational')
  @Public()
  findOperational() {
    return this.usersService.findOperationalUsers();
  }

  /**
   * Ruta literal **antes** de `@Get(':id')` o el comodín se la come.
   *
   * La pantalla del PIN pad de un empleado concreto solo necesita su nombre; antes se traía el
   * roster entero y hacía `.find()`.
   */
  @Get('operational/:id')
  @Public()
  findOperationalOne(@Param('id', ParseUuidPipe) id: string) {
    return this.usersService.findOperationalUser(id);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  async findOne(@Param('id', ParseUuidPipe) id: string) {
    return toUserResponse(await this.usersService.findOne(id));
  }

  // Auditados dentro del service: el interceptor no vería el estado anterior ni
  // podría distinguir un cambio de rol de una edición cualquiera.
  @Post()
  @RequirePermissions('users:create')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return toUserResponse(await this.usersService.create(dto, user));
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return toUserResponse(await this.usersService.update(id, dto, user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users:delete')
  remove(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.remove(id, user);
  }
}
