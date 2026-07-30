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
  Put,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles:read')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions')
  @RequirePermissions('roles:read')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Get(':id')
  @RequirePermissions('roles:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  // Estos cuatro no llevan @Audit(): se auditan dentro del service, que es el único
  // sitio donde el estado anterior todavía existe.
  @Post()
  @RequirePermissions('roles:create')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    return this.rolesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('roles:update')
  update(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('roles:delete')
  remove(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.rolesService.remove(id, user);
  }

  @Put(':id/permissions')
  @RequirePermissions('roles:update')
  assignPermissions(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rolesService.assignPermissions(id, dto, user);
  }
}
