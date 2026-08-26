import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Product } from '../menu/entities/product.entity';
import { StockService } from './stock.service';
import { SetStockDto } from './dto/set-stock.dto';
import { AddStockEntryDto } from './dto/add-stock-entry.dto';
import { QueryProductStockDto } from './dto/query-product-stock.dto';
import { isConcurrentWriteConflict } from '../common/write-conflict';
import { stockSetReason, type IngredientUnit } from './inventory.constants';
import type { PreparationStation } from '../menu/preparation-station.constants';

/** Una fila de la pantalla de existencias. Trae lo justo para pintarla de una sola petición. */
export interface ProductStockRow {
  productId: string;
  name: string;
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  station: PreparationStation;
  isActive: boolean;
  /** ¿Lleva existencias propias? */
  tracked: boolean;
  ingredientId: string | null;
  /** `null`, **no cero**, cuando no se lleva stock: «no lo cuento» y «tengo cero» son distintos. */
  currentStock: number | null;
  minimumStock: number | null;
  unit: IngredientUnit | null;
  stockUpdatedAt: string | null;
  lowStock: boolean;
  /** Para poder explicar por qué no se le pueden llevar existencias. */
  hasRecipe: boolean;
}

interface RawRow {
  productId: string;
  name: string;
  price: string;
  categoryId: string | null;
  categoryName: string | null;
  station: PreparationStation;
  isActive: boolean;
  ingredientId: string | null;
  currentStock: string | null;
  minimumStock: string | null;
  unit: IngredientUnit | null;
  stockUpdatedAt: Date | null;
  hasRecipe: boolean;
}

/**
 * Un stock está bajo si cruzó su mínimo **o si es negativo**.
 *
 * La segunda mitad no es un extra. Un producto recién activado tiene el mínimo en cero, que
 * significa «no me avises de este»; con la regla ingenua (`current <= minimum`), un producto en −5
 * no aparecería **nunca** en la lista de reposición. Un negativo siempre es una señal de que hay
 * que contar, tenga mínimo o no.
 */
const LOW_STOCK_SQL =
  '((i.minimum_stock > 0 AND i.current_stock <= i.minimum_stock) OR i.current_stock < 0)';

@Injectable()
export class ProductStockService {
  constructor(
    @InjectRepository(Ingredient) private readonly ingredientsRepo: Repository<Ingredient>,
    @InjectRepository(RecipeIngredient) private readonly recipesRepo: Repository<RecipeIngredient>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    private readonly stock: StockService,
  ) {}

  async findAll(filters: QueryProductStockDto = {}): Promise<ProductStockRow[]> {
    const qb = this.productsRepo
      .createQueryBuilder('p')
      .leftJoin('categories', 'c', 'c.id = p.category_id')
      // El espejo, solo si está activo: uno dado de baja es historial, no existencias.
      .leftJoin('ingredients', 'i', 'i.product_id = p.id AND i.is_active = true')
      .select('p.id', 'productId')
      .addSelect('p.name', 'name')
      .addSelect('p.price', 'price')
      .addSelect('p.category_id', 'categoryId')
      .addSelect('c.name', 'categoryName')
      .addSelect('p.station', 'station')
      .addSelect('p.is_active', 'isActive')
      .addSelect('i.id', 'ingredientId')
      .addSelect('i.current_stock', 'currentStock')
      .addSelect('i.minimum_stock', 'minimumStock')
      .addSelect('i.unit', 'unit')
      .addSelect('i.updated_at', 'stockUpdatedAt')
      .addSelect(
        'EXISTS (SELECT 1 FROM recipe_ingredients r WHERE r.product_id = p.id)',
        'hasRecipe',
      )
      // `sort_order` de la categoría y luego el nombre: el mismo orden que ve en la carta, para
      // que buscar en la pantalla se parezca a buscar en el estante.
      .orderBy('c.sort_order', 'ASC', 'NULLS LAST')
      .addOrderBy('p.name', 'ASC');

    if (!filters.includeInactive) qb.andWhere('p.is_active = true');
    // `lowStock` implica `tracked`: un producto sin existencias no puede estar bajo mínimos.
    if (filters.lowStock) qb.andWhere(LOW_STOCK_SQL);
    else if (filters.tracked === true) qb.andWhere('i.id IS NOT NULL');
    else if (filters.tracked === false) qb.andWhere('i.id IS NULL');

    const rows = await qb.getRawMany<RawRow>();
    return rows.map((r) => this.toRow(r));
  }

  async findOneRow(productId: string): Promise<ProductStockRow> {
    const rows = await this.findAll({ includeInactive: true });
    const row = rows.find((r) => r.productId === productId);
    if (!row) throw new NotFoundException(`Producto ${productId} no encontrado`);
    return row;
  }

  /** «Ahora tengo N.» Crea el espejo la primera vez y escribe el ajuste. */
  async setStock(productId: string, dto: SetStockDto, userId: string): Promise<ProductStockRow> {
    const mirror = await this.ensureMirror(productId);
    await this.stock.setLevel(
      {
        ingredientId: mirror.id,
        toStock: dto.newStock,
        reasonCode: dto.reasonCode,
        note: dto.note,
      },
      userId,
    );
    return this.findOneRow(productId);
  }

  /**
   * «Llegó mercancía.» **Suma** lo que llegó a lo que haya en ese instante.
   *
   * No es lo mismo que fijar el stock con motivo «Compra», que es lo que hacía la pantalla antes.
   * Un `PUT` manda el total, y el total se leyó cuando se abrió el diálogo: si la barra vendió dos
   * cervezas mientras alguien tecleaba, esas dos ventas **desaparecían** al guardar. Aquí viaja el
   * delta y quien lo aplica es `apply`, con la fila ya bloqueada, así que las dos cosas caben.
   *
   * Se escribe como `entry` de verdad y no como un ajuste: es el único tipo que admite proveedor y
   * costo —de ahí sale el promedio ponderado— y el único que un reporte de compras podría filtrar
   * sin leer el texto del motivo.
   */
  async addEntry(
    productId: string,
    dto: AddStockEntryDto,
    userId: string,
  ): Promise<ProductStockRow> {
    const mirror = await this.ensureMirror(productId);
    await this.stock.record(
      {
        ingredientId: mirror.id,
        type: 'entry',
        quantity: dto.quantity,
        // Misma etiqueta que el motivo «Compra» de la pantalla de recuento, para que el libro
        // mayor se lea igual venga de donde venga.
        reason: stockSetReason('purchase', dto.note),
      },
      userId,
    );
    return this.findOneRow(productId);
  }

  /**
   * Cuánto hay ahora, o `null` si el producto no lleva existencias.
   *
   * Consulta directa y no `findOneRow`, que recorre el catálogo entero: esto lo llama la
   * importación una vez por fila.
   */
  async currentStockOf(productId: string): Promise<number | null> {
    const mirror = await this.ingredientsRepo.findOne({
      where: { productId },
      select: { id: true, currentStock: true, isActive: true },
    });
    return mirror && mirror.isActive ? Number(mirror.currentStock) : null;
  }

  /**
   * El umbral de aviso. No es un movimiento: no cambia cuánto hay, solo a partir de cuándo avisar,
   * así que no tiene sitio en el libro mayor.
   */
  async setMinimum(productId: string, minimumStock: number): Promise<ProductStockRow> {
    const mirror = await this.ensureMirror(productId);
    mirror.minimumStock = Number(minimumStock.toFixed(3));
    await this.ingredientsRepo.save(mirror);
    return this.findOneRow(productId);
  }

  /**
   * Deja de llevar las existencias de un producto.
   *
   * Baja lógica y nunca `DELETE`: el libro mayor apunta al espejo con clave ajena `RESTRICT`, y
   * además el historial de lo que se vendió sigue siendo cierto aunque ya no se cuente.
   */
  async untrack(productId: string): Promise<ProductStockRow> {
    const mirror = await this.ingredientsRepo.findOne({ where: { productId } });
    if (!mirror) throw new NotFoundException('Este producto no lleva existencias');
    if (mirror.isActive) {
      mirror.isActive = false;
      await this.ingredientsRepo.save(mirror);
    }
    return this.findOneRow(productId);
  }

  /**
   * Para `ProductsService.remove`: un 400 que se entiende en vez de un 500 de clave ajena.
   *
   * Se mira el espejo esté activo o no: la clave ajena es `RESTRICT` en los dos casos.
   */
  async assertNotTracked(productId: string): Promise<void> {
    const mirror = await this.ingredientsRepo.findOne({ where: { productId } });
    if (mirror) {
      throw new BadRequestException(
        'Este producto tiene existencias registradas y su historial de movimientos. ' +
          'Desactívalo en vez de borrarlo.',
      );
    }
  }

  /**
   * Devuelve el ingrediente espejo del producto, creándolo la primera vez.
   *
   * **Se crea al fijar el stock, no en un paso aparte.** «Activar el seguimiento» es una ceremonia
   * que solo existe porque el modelo de datos la necesita, y quien usa esto escribe «ahora tengo
   * 12» y espera que funcione. Reactivar uno dado de baja conserva su historial, en vez de empezar
   * un ingrediente nuevo que no explica de dónde salió el número.
   */
  private async ensureMirror(productId: string): Promise<Ingredient> {
    const existing = await this.ingredientsRepo.findOne({ where: { productId } });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        return this.ingredientsRepo.save(existing);
      }
      return existing;
    }

    const product = await this.productsRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Producto ${productId} no encontrado`);

    // La mitad de la regla que impide el doble descuento; la otra está en
    // `RecipesService.setForProduct`. Ninguna de las dos es infalible —son dos read-then-write
    // sobre tablas distintas—, y por eso `aggregateConsumptions` prefiere el espejo si por lo que
    // sea acaban existiendo los dos.
    if ((await this.recipesRepo.countBy({ productId })) > 0) {
      throw new BadRequestException(
        'Este producto ya descuenta por receta. Quítale la receta antes de llevarle existencias ' +
          'propias, o el inventario restaría dos veces la misma venta.',
      );
    }

    try {
      return await this.ingredientsRepo.save(
        this.ingredientsRepo.create({
          productId,
          // Copia del nombre para que el libro mayor se lea sin join. **No es la fuente de la
          // verdad**: las pantallas muestran `products.name`, que puede cambiar después.
          // El recorte es el de la columna, y evita que un nombre largo salga como un error de
          // base de datos sobre una pantalla que solo dice «ahora tengo 12».
          name: product.name.slice(0, 150),
          // Un producto vendible se cuenta en piezas. Ninguna otra unidad tiene sentido aquí, y
          // `IngredientsService.update` impide cambiarla.
          unit: 'units',
          currentStock: 0,
          minimumStock: 0,
          costPerUnit: 0,
        }),
      );
    } catch (err) {
      // `UQ_ingredients_product_id`: dos primeros «ahora tengo 12» a la vez. La respuesta correcta
      // es la fila que ganó, no un 500 sobre la pantalla de stock.
      if (isConcurrentWriteConflict(err)) {
        const winner = await this.ingredientsRepo.findOne({ where: { productId } });
        if (winner) return winner;
      }
      throw err;
    }
  }

  /**
   * `getRawMany()` **no pasa por los transformadores de TypeORM**: `price`, `current_stock` y
   * `minimum_stock` llegan como `string` desde Postgres. Sin este mapeo, el móvil concatena
   * `"12" + 1` y muestra `121`, que no rompe nada hasta que alguien lo lee.
   */
  private toRow(r: RawRow): ProductStockRow {
    const tracked = r.ingredientId !== null;
    const currentStock = tracked ? Number(r.currentStock) : null;
    const minimumStock = tracked ? Number(r.minimumStock) : null;
    return {
      productId: r.productId,
      name: r.name,
      price: Number(r.price),
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      station: r.station,
      isActive: r.isActive,
      tracked,
      ingredientId: r.ingredientId,
      currentStock,
      minimumStock,
      unit: tracked ? r.unit : null,
      stockUpdatedAt: r.stockUpdatedAt ? new Date(r.stockUpdatedAt).toISOString() : null,
      lowStock:
        currentStock !== null &&
        ((minimumStock !== null && minimumStock > 0 && currentStock <= minimumStock) ||
          currentStock < 0),
      hasRecipe: r.hasRecipe,
    };
  }
}
