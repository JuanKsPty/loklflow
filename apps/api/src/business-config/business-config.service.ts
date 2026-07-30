import { Injectable } from '@nestjs/common';
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

  /**
   * Configuración del negocio. La crea con valores por defecto si falta, en lugar de
   * lanzar 404: es una fila única de la que dependen vistas como el recibo, y un 404
   * ahí solo produciría una página rota.
   */
  async get(): Promise<BusinessConfig> {
    const config = await this.repo.findOne({ where: {} });
    if (config) return config;
    return this.repo.save(this.repo.create({ businessName: 'Mi Negocio' }));
  }

  async update(dto: UpdateBusinessConfigDto) {
    const config = await this.get();
    Object.assign(config, dto);
    return this.repo.save(config);
  }
}
