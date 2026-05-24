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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private rolesService: RolesService,
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

  async create(dto: CreateUserDto) {
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
    return this.usersRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (existing) throw new BadRequestException(`Email "${dto.email}" already in use`);
    }

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

    return this.usersRepo.save(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepo.save(user);
  }
}
