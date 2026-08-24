import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Modifier } from './entities/modifier.entity';
import { ProductAvailability } from './entities/product-availability.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { isAvailableNow } from './availability';
import { ProductStockService } from '../inventory/product-stock.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepo: Repository<Product>,
    @InjectRepository(Modifier)
    private modifiersRepo: Repository<Modifier>,
    private readonly productStock: ProductStockService,
  ) {}

  /**
   * `opts` es opcional y **el comportamiento por defecto no cambia**: sin él devuelve todo,
   * incluidos los productos inactivos y los fuera de horario, que es lo que `/admin/menu/products`
   * necesita para poder editarlos.
   *
   * Los filtros existen para el menú público, donde ofrecer algo que no se puede servir es un
   * cliente que pide y se lleva un «no hay».
   */
  async findAll(opts?: {
    /** Solo lo activo. */
    activeOnly?: boolean;
    /** Instante contra el que evaluar `product_availabilities`. */
    availableAt?: Date;
    /** Zona del negocio. Sin ella se usaría la del servidor, que es de otro sitio. */
    timeZone?: string;
  }) {
    const products = await this.productsRepo.find({
      // `modifiers.options` anidado y no `modifiers: true`: sin las opciones, un grupo de
      // modificadores llega vacío y un producto con modificador obligatorio no se puede pedir.
      // Las pantallas del personal lo tapaban pidiendo los modificadores por separado.
      relations: { category: true, modifiers: { options: true }, availabilities: true },
      order: { name: 'ASC' },
    });

    if (!opts) return products;

    const at = opts.availableAt;
    const timeZone = opts.timeZone ?? 'UTC';

    return products.filter((product) => {
      if (opts.activeOnly && !product.isActive) return false;
      if (at && !isAvailableNow(product.availabilities, at, timeZone)) return false;
      return true;
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
      /**
       * Faltaba, y no era inocuo: todo producto creado por la API se quedaba en `kitchen`
       * aunque el formulario mandara `bar`, porque el DTO lo declaraba y nadie lo copiaba.
       * El aviso a Cocina de `OrdersService.create` mira justo esta columna, así que una
       * botella de agua sonaba en cocina y el KDS pintaba tarjetas que nadie preparaba.
       * El seed no lo sufría porque escribe por repositorio, no por la API.
       */
      station: dto.station ?? 'kitchen',
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
    if (dto.station !== undefined) product.station = dto.station;
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
    // Un producto con existencias tiene su ingrediente espejo apuntándolo con clave ajena
    // `RESTRICT`, así que el borrado fallaría con un error de base de datos —un 500— en lugar de
    // decir algo útil. Se comprueba antes para poder explicarlo.
    await this.productStock.assertNotTracked(id);
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
