import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { AuditModule } from '../audit/audit.module';
import { TokenVersionModule } from '../token-version/token-version.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission]),
    TokenVersionModule,
    AuditModule,
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
