import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sector } from './entities/sector.entity';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';

@Injectable()
export class SectorsService {
  constructor(
    @InjectRepository(Sector)
    private sectorsRepo: Repository<Sector>,
  ) {}

  findAll() {
    return this.sectorsRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const sector = await this.sectorsRepo.findOne({ where: { id } });
    if (!sector) throw new NotFoundException(`Sector ${id} not found`);
    return sector;
  }

  create(dto: CreateSectorDto) {
    const sector = this.sectorsRepo.create(dto);
    return this.sectorsRepo.save(sector);
  }

  async update(id: string, dto: UpdateSectorDto) {
    const sector = await this.findOne(id);
    Object.assign(sector, dto);
    return this.sectorsRepo.save(sector);
  }

  async remove(id: string) {
    const sector = await this.findOne(id);
    await this.sectorsRepo.remove(sector);
  }
}
