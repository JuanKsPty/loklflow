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
import { AuditService } from '../audit/audit.service';
import { redactPick } from '../audit/audit-redact';
import type { AuditAction } from '../audit/audit-actions.constants';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/** Campos del rol que se guardan como snapshot en la bitácora. */
const AUDITED_ROLE_FIELDS = [
  'name',
  'description',
  'maxDiscountPercentage',
  'isActive',
] as const;

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionsRepo: Repository<RolePermission>,
    private readonly audit: AuditService,
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

  async create(dto: CreateRoleDto, actor?: JwtPayload) {
    const existing = await this.rolesRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new BadRequestException(`Role "${dto.name}" already exists`);
    const role = this.rolesRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      maxDiscountPercentage: dto.maxDiscountPercentage ?? 0,
    });
    const saved = await this.rolesRepo.save(role);
    await this.log('role.created', saved.id, actor, {
      newValue: redactPick(saved, AUDITED_ROLE_FIELDS),
    });
    return saved;
  }

  async update(id: string, dto: UpdateRoleDto, actor?: JwtPayload) {
    const role = await this.findOne(id);
    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('Cannot rename system roles');
    }
    // Snapshot ANTES del Object.assign: después el estado previo ya no existe, y es
    // la razón por la que esto no se puede auditar desde el interceptor.
    const before = redactPick(role, AUDITED_ROLE_FIELDS);
    Object.assign(role, dto);
    const saved = await this.rolesRepo.save(role);
    await this.log('role.updated', id, actor, {
      oldValue: before,
      newValue: redactPick(saved, AUDITED_ROLE_FIELDS),
    });
    return saved;
  }

  async remove(id: string, actor?: JwtPayload) {
    const role = await this.findOne(id);
    if (role.isSystem) throw new BadRequestException('Cannot delete system roles');
    // Es un borrado físico: sin este snapshot no quedaría constancia de qué se borró.
    const before = redactPick(role, AUDITED_ROLE_FIELDS);
    await this.rolesRepo.remove(role);
    await this.log('role.deleted', id, actor, { oldValue: before });
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto, actor?: JwtPayload) {
    const role = await this.findOne(id);
    const permissions = await this.permissionsRepo.findBy({
      id: In(dto.permissionIds),
    });
    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid');
    }

    // Hay que leer el set anterior antes del delete de abajo, que lo borra entero.
    const before = await this.getPermissionsForRole(id);

    await this.rolePermissionsRepo.delete({ role: { id } });

    const newRolePerms = permissions.map((p) =>
      this.rolePermissionsRepo.create({ role, permission: p }),
    );
    await this.rolePermissionsRepo.save(newRolePerms);

    const after = permissions.map((p) => p.key).sort();
    await this.log('role.permissions_changed', id, actor, {
      oldValue: { permissions: [...before].sort() },
      newValue: { permissions: after },
    });
    return this.findOne(id);
  }

  private log(
    action: AuditAction,
    roleId: string,
    actor: JwtPayload | undefined,
    values: { oldValue?: unknown; newValue?: unknown },
  ) {
    return this.audit.createLog({
      userId: actor?.sub,
      userName: actor?.name ?? actor?.email ?? undefined,
      action,
      entityType: 'role',
      entityId: roleId,
      ...values,
    });
  }

  async getPermissionsForRole(roleId: string): Promise<string[]> {
    const rps = await this.rolePermissionsRepo.find({
      where: { role: { id: roleId } },
      relations: { permission: true },
    });
    return rps.map((rp) => rp.permission.key);
  }
}
