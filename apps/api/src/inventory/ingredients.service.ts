import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Ingredient } from './entities/ingredient.entity';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { StockService } from './stock.service';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient) private readonly ingredientsRepo: Repository<Ingredient>,
    private readonly stock: StockService,
  ) {}

  /**
   * El **catálogo de insumos**, sin los espejos de producto.
   *
   * Un espejo no es un ingrediente que se pueda meter en una receta ni comprar a un proveedor: es
   * el contador de un producto vendible y tiene su propia pantalla. Mezclarlos aquí llenaba el
   * editor de recetas de opciones que crean el doble descuento con dos clics.
   */
  findAll() {
    return this.ingredientsRepo.find({ where: { productId: IsNull() }, order: { name: 'ASC' } });
  }

  /**
   * Los que están en o por debajo del mínimo, para la pantalla de compras.
   *
   * Se calcula comparando dos columnas, así que no se puede expresar con un `where` de
   * objeto: TypeORM no compara columna contra columna sin `QueryBuilder`. Un mínimo en cero
   * queda fuera porque significa «no me avises de este», no «siempre bajo».
   */
  findLowStock() {
    return this.ingredientsRepo
      .createQueryBuilder('i')
      // Los espejos tienen su propio `?lowStock=true` en la pantalla de existencias.
      .where('i.product_id IS NULL')
      .andWhere('i.is_active = true')
      .andWhere('i.minimum_stock > 0')
      .andWhere('i.current_stock <= i.minimum_stock')
      .orderBy('i.name', 'ASC')
      .getMany();
  }

  async findOne(id: string) {
    const ingredient = await this.ingredientsRepo.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException(`Ingrediente ${id} no encontrado`);
    return ingredient;
  }

  /**
   * El stock inicial **no** se escribe en la columna: se registra como un ajuste.
   *
   * Así el libro mayor explica desde el primer día de dónde salió cada unidad, en lugar de
   * empezar con un número que aparece de la nada y no cuadra con ningún movimiento.
   */
  async create(dto: CreateIngredientDto, userId: string) {
    const { initialStock, ...rest } = dto;
    const ingredient = await this.ingredientsRepo.save(
      this.ingredientsRepo.create({ ...rest, currentStock: 0 }),
    );

    if (initialStock && initialStock > 0) {
      await this.stock.record(
        {
          ingredientId: ingredient.id,
          type: 'adjustment',
          quantity: initialStock,
          direction: 'increase',
          reason: 'Stock inicial',
        },
        userId,
      );
      return this.findOne(ingredient.id);
    }

    return ingredient;
  }


  /**
   * `isActive: false` **no** se acepta por aquí, y la asimetría es deliberada.
   *
   * Desactivar es una baja lógica: tiene su propio endpoint, con permiso `inventory:delete`, y su
   * comentario explicando por qué no se borra. Permitirlo también en el PATCH —que va con
   * `inventory:update`— hacía que ese permiso no sirviera para nada: cualquiera con permiso de
   * edición podía dar de baja, que es justo lo que el controlador guarda aparte. Los formularios lo
   * hacían así con un interruptor, y por eso `inventory:delete` no lo ejercía nadie.
   *
   * Reactivar **sí** se permite por PATCH: no es destructivo, y exigir un endpoint aparte para
   * volver a poner algo en circulación sería ceremonia sin motivo.
   */
  async update(id: string, dto: UpdateIngredientDto) {
    if (dto.isActive === false) {
      throw new BadRequestException(
        'Para dar de baja un ingrediente usa la baja lógica, no la edición.',
      );
    }
    const ingredient = await this.findOne(id);
    // El nombre y la unidad de un espejo los manda el producto: renombrarlo aquí haría que el
    // libro mayor hablara de algo que ya no existe, y cambiar la unidad haría que la pantalla
    // dijera «3 kg» de algo que se descuenta de una en una.
    if (ingredient.productId && (dto.name !== undefined || dto.unit !== undefined)) {
      throw new BadRequestException(
        'El nombre y la unidad de un producto con existencias propias se cambian en la ficha ' +
          'del producto.',
      );
    }
    Object.assign(ingredient, dto);
    return this.ingredientsRepo.save(ingredient);
  }

  /**
   * Baja lógica. Igual que con los proveedores: el ingrediente está referenciado por sus
   * movimientos y por las recetas, y la clave ajena de ambas es `RESTRICT` — un borrado
   * fallaría con un error de base de datos en lugar de decir algo útil.
   */
  async deactivate(id: string) {
    const ingredient = await this.findOne(id);
    ingredient.isActive = false;
    return this.ingredientsRepo.save(ingredient);
  }
}
