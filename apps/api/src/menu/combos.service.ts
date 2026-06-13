import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Combo } from './entities/combo.entity';
import { ComboItem } from './entities/combo-item.entity';
import { Product } from './entities/product.entity';
import { CreateComboDto } from './dto/create-combo.dto';
import { UpdateComboDto } from './dto/update-combo.dto';

@Injectable()
export class CombosService {
  constructor(
    @InjectRepository(Combo)
    private combosRepo: Repository<Combo>,
    @InjectRepository(Product)
    private productsRepo: Repository<Product>,
  ) {}

  findAll() {
    return this.combosRepo.find({
      relations: { items: { product: true } },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const combo = await this.combosRepo.findOne({
      where: { id },
      relations: { items: { product: true } },
    });
    if (!combo) throw new NotFoundException(`Combo ${id} not found`);
    return combo;
  }

  async create(dto: CreateComboDto) {
    const combo = this.combosRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      imageUrl: dto.imageUrl ?? null,
      isActive: dto.isActive ?? true,
      items: await this.buildItems(dto.items),
    });
    const saved = await this.combosRepo.save(combo);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateComboDto) {
    const combo = await this.findOne(id);

    if (dto.name !== undefined) combo.name = dto.name;
    if (dto.description !== undefined) combo.description = dto.description ?? null;
    if (dto.price !== undefined) combo.price = dto.price;
    if (dto.imageUrl !== undefined) combo.imageUrl = dto.imageUrl ?? null;
    if (dto.isActive !== undefined) combo.isActive = dto.isActive;
    if (dto.items !== undefined) combo.items = await this.buildItems(dto.items);

    const saved = await this.combosRepo.save(combo);
    return this.findOne(saved.id);
  }

  async remove(id: string) {
    const combo = await this.findOne(id);
    await this.combosRepo.remove(combo);
  }

  private async buildItems(items?: CreateComboDto['items']): Promise<ComboItem[]> {
    if (!items || items.length === 0) return [];
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.productsRepo.find({ where: { id: In(productIds) } });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos del combo no existen');
    }
    return items.map((i) =>
      Object.assign(new ComboItem(), {
        productId: i.productId,
        quantity: i.quantity ?? 1,
        allowSubstitution: i.allowSubstitution ?? false,
      }),
    );
  }
}
