import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modifier } from './entities/modifier.entity';
import { ModifierOption } from './entities/modifier-option.entity';
import { CreateModifierDto } from './dto/create-modifier.dto';
import { UpdateModifierDto } from './dto/update-modifier.dto';

@Injectable()
export class ModifiersService {
  constructor(
    @InjectRepository(Modifier)
    private modifiersRepo: Repository<Modifier>,
  ) {}

  findAll() {
    return this.modifiersRepo.find({
      relations: { options: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const modifier = await this.modifiersRepo.findOne({
      where: { id },
      relations: { options: true },
    });
    if (!modifier) throw new NotFoundException(`Modifier ${id} not found`);
    return modifier;
  }

  async create(dto: CreateModifierDto) {
    const modifier = this.modifiersRepo.create({
      name: dto.name,
      isRequired: dto.isRequired ?? false,
      allowMultiple: dto.allowMultiple ?? false,
      minSelections: dto.minSelections ?? 0,
      maxSelections: dto.maxSelections ?? null,
      options: this.buildOptions(dto.options),
    });
    const saved = await this.modifiersRepo.save(modifier);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateModifierDto) {
    const modifier = await this.findOne(id);

    if (dto.name !== undefined) modifier.name = dto.name;
    if (dto.isRequired !== undefined) modifier.isRequired = dto.isRequired;
    if (dto.allowMultiple !== undefined) modifier.allowMultiple = dto.allowMultiple;
    if (dto.minSelections !== undefined) modifier.minSelections = dto.minSelections;
    if (dto.maxSelections !== undefined) modifier.maxSelections = dto.maxSelections;
    if (dto.options !== undefined) modifier.options = this.buildOptions(dto.options);

    const saved = await this.modifiersRepo.save(modifier);
    return this.findOne(saved.id);
  }

  async remove(id: string) {
    const modifier = await this.findOne(id);
    await this.modifiersRepo.remove(modifier);
  }

  private buildOptions(options?: CreateModifierDto['options']): ModifierOption[] {
    if (!options) return [];
    return options.map((o) =>
      Object.assign(new ModifierOption(), {
        name: o.name,
        priceAdjustment: o.priceAdjustment ?? 0,
        isDefault: o.isDefault ?? false,
        sortOrder: o.sortOrder ?? 0,
        isActive: o.isActive ?? true,
      }),
    );
  }
}
