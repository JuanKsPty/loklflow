import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionsRepo: Repository<RolePermission>,
  ) {}

  findAll() {
    return this.rolesRepo.find({ where: { isActive: true } });
  }

  findAllPermissions() {
    return this.permissionsRepo.find({ order: { module: 'ASC', action: 'ASC' } });
  }

  async findOne(id: string) {
    const role = await this.rolesRepo.findOne({
      where: { id },
      relations: { rolePermissions: { permission: true } },
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.rolesRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new BadRequestException(`Role "${dto.name}" already exists`);
    const role = this.rolesRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      maxDiscountPercentage: dto.maxDiscountPercentage ?? 0,
    });
    return this.rolesRepo.save(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('Cannot rename system roles');
    }
    Object.assign(role, dto);
    return this.rolesRepo.save(role);
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) throw new BadRequestException('Cannot delete system roles');
    await this.rolesRepo.remove(role);
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto) {
    const role = await this.findOne(id);
    const permissions = await this.permissionsRepo.findBy({
      id: In(dto.permissionIds),
    });
    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid');
    }

    await this.rolePermissionsRepo.delete({ role: { id } });

    const newRolePerms = permissions.map((p) =>
      this.rolePermissionsRepo.create({ role, permission: p }),
    );
    await this.rolePermissionsRepo.save(newRolePerms);
    return this.findOne(id);
  }

  async getPermissionsForRole(roleId: string): Promise<string[]> {
    const rps = await this.rolePermissionsRepo.find({
      where: { role: { id: roleId } },
      relations: { permission: true },
    });
    return rps.map((rp) => rp.permission.key);
  }
}
