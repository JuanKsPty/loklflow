import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Modifier } from './entities/modifier.entity';
import { ProductAvailability } from './entities/product-availability.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepo: Repository<Product>,
    @InjectRepository(Modifier)
    private modifiersRepo: Repository<Modifier>,
  ) {}

  findAll() {
    return this.productsRepo.find({
      relations: { category: true, modifiers: true, availabilities: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const product = await this.productsRepo.findOne({
      where: { id },
      relations: { category: true, modifiers: true, availabilities: true },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async create(dto: CreateProductDto) {
    const product = this.productsRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      imageUrl: dto.imageUrl ?? null,
      categoryId: dto.categoryId ?? null,
      isActive: dto.isActive ?? true,
      modifiers: await this.resolveModifiers(dto.modifierIds),
      availabilities: this.buildAvailabilities(dto.availabilities),
    });
    const saved = await this.productsRepo.save(product);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description ?? null;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl ?? null;
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId ?? null;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    if (dto.modifierIds !== undefined) {
      product.modifiers = await this.resolveModifiers(dto.modifierIds);
    }
    if (dto.availabilities !== undefined) {
      // replace strategy: orphan removal via cascade on the OneToMany relation
      product.availabilities = this.buildAvailabilities(dto.availabilities);
    }

    const saved = await this.productsRepo.save(product);
    return this.findOne(saved.id);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productsRepo.remove(product);
  }

  private async resolveModifiers(modifierIds?: string[]): Promise<Modifier[]> {
    if (!modifierIds || modifierIds.length === 0) return [];
    const modifiers = await this.modifiersRepo.find({ where: { id: In(modifierIds) } });
    if (modifiers.length !== modifierIds.length) {
      throw new BadRequestException('Uno o más modificadores no existen');
    }
    return modifiers;
  }

  private buildAvailabilities(
    availabilities?: CreateProductDto['availabilities'],
  ): ProductAvailability[] {
    if (!availabilities) return [];
    return availabilities.map((a) =>
      Object.assign(new ProductAvailability(), {
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isAvailable: a.isAvailable ?? true,
      }),
    );
  }
}
