import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessConfig } from './entities/business-config.entity';
import { UpdateBusinessConfigDto } from './dto/update-business-config.dto';

@Injectable()
export class BusinessConfigService {
  constructor(
    @InjectRepository(BusinessConfig)
    private readonly repo: Repository<BusinessConfig>,
  ) {}

  async get() {
    const config = await this.repo.findOne({ where: {} });
    if (!config) throw new NotFoundException('Business config not found');
    return config;
  }

  async update(dto: UpdateBusinessConfigDto) {
    let config = await this.repo.findOne({ where: {} });
    if (!config) {
      config = this.repo.create({ businessName: dto.businessName ?? 'Mi Negocio' });
    }
    Object.assign(config, dto);
    return this.repo.save(config);
  }
}
