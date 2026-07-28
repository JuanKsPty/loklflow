import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RolesService } from '../roles/roles.service';
import { AuditService } from '../audit/audit.service';
import type { AuditAction } from '../audit/audit-actions.constants';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private rolesService: RolesService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.usersRepo.find({ where: { isActive: true } });
  }

  async findOne(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByEmail(email: string) {
    return this.usersRepo.findOne({
      where: { email },
      select: { id: true, name: true, email: true, password: true, pin: true, isActive: true },
      relations: { role: true },
    });
  }

  async findByIdWithCredentials(id: string) {
    return this.usersRepo.findOne({
      where: { id },
      select: { id: true, name: true, email: true, password: true, pin: true, isActive: true },
      relations: { role: true },
    });
  }

  async findOperationalUsers() {
    return this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.isActive = :active', { active: true })
      .andWhere('user.pin IS NOT NULL')
      .select(['user.id', 'user.name', 'role.id', 'role.name'])
      .getMany();
  }

  /** Usuarios activos de un rol por nombre (para fan-out de notificaciones). */
  async findActiveByRoleName(roleName: string) {
    return this.usersRepo
      .createQueryBuilder('user')
      .leftJoin('user.role', 'role')
      .where('user.isActive = :active', { active: true })
      .andWhere('role.name = :roleName', { roleName })
      .select(['user.id'])
      .getMany();
  }

  async create(dto: CreateUserDto, actor?: JwtPayload) {
    if (!dto.email && !dto.pin) {
      throw new BadRequestException('User must have either an email or a PIN');
    }
    if (dto.email) {
      const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (existing) throw new BadRequestException(`Email "${dto.email}" already in use`);
    }

    const role = await this.rolesService.findOne(dto.roleId);

    const user = this.usersRepo.create({
      name: dto.name,
      email: dto.email ?? null,
      role,
      password: dto.password ? await bcrypt.hash(dto.password, 10) : null,
      pin: dto.pin ? await bcrypt.hash(dto.pin, 10) : null,
    });
    const saved = await this.usersRepo.save(user);
    await this.log('user.created', saved.id, actor, {
      newValue: this.snapshot(saved),
    });
    return saved;
  }

  async update(id: string, dto: UpdateUserDto, actor?: JwtPayload) {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (existing) throw new BadRequestException(`Email "${dto.email}" already in use`);
    }

    // Snapshot antes de mutar la entidad cargada.
    const before = this.snapshot(user);
    const previousRoleName = user.role?.name ?? null;

    if (dto.roleId) {
      user.role = await this.rolesService.findOne(dto.roleId);
    }
    if (dto.password) {
      (user as User & { password: string }).password = await bcrypt.hash(dto.password, 10);
    }
    if (dto.pin) {
      (user as User & { pin: string }).pin = await bcrypt.hash(dto.pin, 10);
    }
    if (dto.name) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email ?? null;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    const saved = await this.usersRepo.save(user);
    const after = this.snapshot(saved);

    await this.log('user.updated', id, actor, { oldValue: before, newValue: after });

    // El cambio de rol se registra aparte porque es la acción de mayor impacto en
    // seguridad y hay que poder filtrarla sin leer el diff de cada edición.
    if (dto.roleId && saved.role?.name !== previousRoleName) {
      await this.log('user.role_changed', id, actor, {
        oldValue: { role: previousRoleName },
        newValue: { role: saved.role?.name ?? null },
      });
    }

    return saved;
  }

  async remove(id: string, actor?: JwtPayload) {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepo.save(user);
    await this.log('user.deactivated', id, actor, {
      oldValue: { isActive: true },
      newValue: { isActive: false },
    });
  }

  /**
   * Campos del empleado que van a la bitácora. Se enumeran de forma explícita en lugar
   * de volcar la entidad: `User` arrastra los hashes de password y pin, y no deben
   * acabar en una tabla que el rol Gerente puede leer.
   */
  private snapshot(user: User): Record<string, unknown> {
    return {
      name: user.name,
      email: user.email,
      role: user.role?.name ?? null,
      isActive: user.isActive,
    };
  }

  private log(
    action: AuditAction,
    userId: string,
    actor: JwtPayload | undefined,
    values: { oldValue?: unknown; newValue?: unknown },
  ) {
    return this.audit.createLog({
      userId: actor?.sub,
      userName: actor?.name ?? actor?.email ?? undefined,
      action,
      entityType: 'user',
      entityId: userId,
      ...values,
    });
  }
}
