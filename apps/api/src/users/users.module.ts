import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RolesModule } from '../roles/roles.module';
import { AuditModule } from '../audit/audit.module';
import { TokenVersionModule } from '../token-version/token-version.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RolesModule, AuditModule, TokenVersionModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
