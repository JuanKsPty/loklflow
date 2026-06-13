import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { TableStatus } from './status.constants';
import { RestaurantTable } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(RestaurantTable)
    private tablesRepo: Repository<RestaurantTable>,
  ) {}

  findAll() {
    return this.tablesRepo.find({
      relations: { sector: true },
      order: { number: 'ASC' },
    });
  }

  async findOne(id: string) {
    const table = await this.tablesRepo.findOne({
      where: { id },
      relations: { sector: true },
    });
    if (!table) throw new NotFoundException(`Table ${id} not found`);
    return table;
  }

  async create(dto: CreateTableDto) {
    const table = this.tablesRepo.create({
      number: dto.number,
      sectorId: dto.sectorId,
      capacity: dto.capacity,
      status: dto.status ?? 'available',
      isActive: dto.isActive ?? true,
      qrCode: randomUUID(),
    });
    const saved = await this.saveUnique(table);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateTableDto) {
    const table = await this.findOne(id);
    Object.assign(table, dto);
    const saved = await this.saveUnique(table);
    return this.findOne(saved.id);
  }

  async updateStatus(id: string, status: TableStatus) {
    const table = await this.findOne(id);
    table.status = status;
    await this.tablesRepo.save(table);
    return this.findOne(id);
  }

  async remove(id: string) {
    const table = await this.findOne(id);
    await this.tablesRepo.remove(table);
  }

  private async saveUnique(table: RestaurantTable) {
    try {
      return await this.tablesRepo.save(table);
    } catch (err) {
      if (err instanceof QueryFailedError && /unique|duplicate/i.test(err.message)) {
        throw new BadRequestException(
          `Ya existe una mesa con el número ${table.number} en ese sector`,
        );
      }
      throw err;
    }
  }
}
