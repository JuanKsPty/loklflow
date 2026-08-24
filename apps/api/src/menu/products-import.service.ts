import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ImportProductRowDto, ImportProductsDto } from './dto/import-products.dto';
import { fold, productKey } from './name-key';
import { ProductStockService } from '../inventory/product-stock.service';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

export interface ImportRowResult {
  /** La del archivo, no el índice del lote. */
  line: number;
  name: string;
  status: 'created' | 'updated' | 'failed';
  productId?: string;
  /** Solo si `failed`, y en español: lo lee quien importó, no un programa. */
  reason?: string;
}

export interface ImportProductsResult {
  created: number;
  updated: number;
  failed: number;
  categoriesCreated: string[];
  rows: ImportRowResult[];
}

/** Identificador del cerrojo consultivo. Arbitrario pero fijo: es la clave, no un valor. */
const LOCK_KEY = 8_140_233;

@Injectable()
export class ProductsImportService {
  private readonly logger = new Logger(ProductsImportService.name);

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    private readonly dataSource: DataSource,
    private readonly productStock: ProductStockService,
  ) {}

  /**
   * Una tanda de filas del CSV.
   *
   * **Transaccional por fila, no por tanda**, y el motivo importa: una tanda es un artefacto del
   * límite de 100 kB del cuerpo de Express, no una unidad que el usuario haya elegido. Deshacer 199
   * filas buenas porque la 137 trae una categoría mal escrita tira trabajo por un motivo que él ni
   * siquiera ve. Y la atomicidad del archivo entero es imposible de todas formas —son veinticinco
   * peticiones—, así que una transacción por tanda *parece* atómica sin serlo, que es lo peor de
   * las dos opciones.
   *
   * Lo que **sí** es transaccional es cada fila por dentro: producto, ingrediente espejo y
   * movimiento inicial van juntos, porque un producto con existencias activadas y sin su fila de
   * ingrediente revienta más tarde, al cerrar una cuenta.
   *
   * La recuperación de una importación a medias no es deshacerla: es **volver a pasar el mismo
   * archivo**. Al casar por nombre, lo que entró se actualiza y lo que faltaba se crea.
   */
  async import(dto: ImportProductsDto, user: JwtPayload): Promise<ImportProductsResult> {
    /**
     * Un cerrojo consultivo mientras dura la tanda.
     *
     * Dos importaciones simultáneas —el dueño en el portátil, el padre en el móvil— leen el mismo
     * índice al empezar y ninguna ve a la otra: las dos verían que falta «Taco» y las dos lo
     * crearían, porque `products.name` no tiene índice único que lo impida. Serializar es una línea
     * y decirlo es más honesto que fusionar duplicados después.
     */
    const [{ obtenido }] = (await this.dataSource.query(
      'SELECT pg_try_advisory_lock($1) AS obtenido',
      [LOCK_KEY],
    )) as [{ obtenido: boolean }];
    if (!obtenido) {
      throw new BadRequestException(
        'Ya hay una importación en curso. Espera a que termine antes de empezar otra.',
      );
    }

    try {
      return await this.importarConCerrojo(dto, user);
    } finally {
      await this.dataSource.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  }

  private async importarConCerrojo(
    dto: ImportProductsDto,
    user: JwtPayload,
  ): Promise<ImportProductsResult> {
    const puedeStock = user.permissions?.includes('inventory:create') ?? false;

    // ── Categorías ──────────────────────────────────────────────────────────
    // Una sola consulta: un restaurante tiene menos de cincuenta.
    const todas = await this.categories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
    const porCategoria = new Map<string, Category>();
    for (const c of todas) {
      // `categories.name` **no** tiene índice único, así que puede haber dos «Bebidas». Gana la
      // primera en el mismo orden que usa `CategoriesService.findAll()`: determinista, en vez de
      // «la que devolviera Postgres esta vez».
      const clave = fold(c.name);
      if (!porCategoria.has(clave)) porCategoria.set(clave, c);
    }

    // Las que faltan se crean **antes** del bucle, una vez por nombre distinto. Dentro de la fila,
    // dos filas con la misma categoría nueva crearían dos categorías iguales.
    const categoriesCreated: string[] = [];
    if (dto.createMissingCategories) {
      const faltan = new Map<string, string>();
      for (const row of dto.rows) {
        const nombre = row.categoryName?.trim();
        if (!nombre) continue;
        const clave = fold(nombre);
        if (!porCategoria.has(clave) && !faltan.has(clave)) faltan.set(clave, nombre);
      }
      for (const [clave, nombre] of faltan) {
        const creada = await this.categories.save(
          this.categories.create({ name: nombre, sortOrder: 0, isActive: true }),
        );
        porCategoria.set(clave, creada);
        categoriesCreated.push(nombre);
      }
    }

    // ── Índice de productos ─────────────────────────────────────────────────
    // `select` acotado a propósito: sin él TypeORM arrastraría las relaciones y esta sería la
    // consulta más cara de la aplicación.
    const existentes = await this.products.find({ select: { id: true, name: true } });
    const porProducto = new Map<string, { id: string; name: string }>();
    const ambiguos = new Set<string>();
    for (const p of existentes) {
      const clave = productKey(p.name);
      if (porProducto.has(clave)) ambiguos.add(clave);
      else porProducto.set(clave, p);
    }

    const rows: ImportRowResult[] = [];
    for (const row of dto.rows) {
      rows.push(
        await this.importarFila(row, { porCategoria, porProducto, ambiguos, puedeStock, user }),
      );
    }

    return {
      created: rows.filter((r) => r.status === 'created').length,
      updated: rows.filter((r) => r.status === 'updated').length,
      failed: rows.filter((r) => r.status === 'failed').length,
      categoriesCreated,
      rows,
    };
  }

  private async importarFila(
    row: ImportProductRowDto,
    ctx: {
      porCategoria: Map<string, Category>;
      porProducto: Map<string, { id: string; name: string }>;
      ambiguos: Set<string>;
      puedeStock: boolean;
      user: JwtPayload;
    },
  ): Promise<ImportRowResult> {
    const clave = productKey(row.name);
    const fallo = (reason: string): ImportRowResult => ({
      line: row.line,
      name: row.name,
      status: 'failed',
      reason,
    });

    // Ambigüedad en **sus** datos, no en los nuestros: no se adivina cuál actualizar.
    if (ctx.ambiguos.has(clave)) {
      return fallo(
        `Hay más de un producto llamado «${row.name}». Renómbralos en la app antes de importar.`,
      );
    }

    // `undefined` = «no toques este campo». El CSV no sabe expresar «quítale la categoría»: una
    // celda vacía en un archivo que solo trae nombres y precios no puede desclasificar el menú.
    let categoryId: string | undefined;
    if (row.categoryName?.trim()) {
      const categoria = ctx.porCategoria.get(fold(row.categoryName));
      if (!categoria) return fallo(`La categoría «${row.categoryName.trim()}» no existe.`);
      categoryId = categoria.id;
    }

    const quiereStock = row.stock !== undefined || row.minimumStock !== undefined;
    if (quiereStock && !ctx.puedeStock) {
      return fallo('No tienes permiso para registrar existencias.');
    }

    const encontrado = ctx.porProducto.get(clave);

    try {
      const resultado = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Product);
        let product: Product;
        let status: 'created' | 'updated';

        if (encontrado) {
          /**
           * **Sin `relations`**, y es deliberado: `availabilities` lleva
           * `orphanedRowAction: 'delete'`, así que asignarle `[]` en una actualización borraría
           * los horarios del producto. Con la propiedad sin cargar (`undefined`), `save` la deja
           * en paz. No añadir la relación «por si acaso».
           */
          product = await repo.findOneOrFail({ where: { id: encontrado.id } });
          product.name = row.name; // el archivo manda en mayúsculas y espacios
          product.price = row.price;
          if (row.description !== undefined) product.description = row.description || null;
          if (categoryId !== undefined) product.categoryId = categoryId;
          if (row.station !== undefined) product.station = row.station;
          if (row.isActive !== undefined) product.isActive = row.isActive;
          status = 'updated';
        } else {
          product = repo.create({
            name: row.name,
            description: row.description ?? null,
            price: row.price,
            imageUrl: null,
            categoryId: categoryId ?? null,
            station: row.station ?? 'kitchen',
            // El valor por defecto se aplica **aquí**, al crear, y no en el lector: así una celda
            // vacía significa «no toques» al actualizar y «activo» al crear.
            isActive: row.isActive ?? true,
            availabilities: [],
          });
          status = 'created';
        }

        const saved = await repo.save(product);
        return { product: saved, status };
      });

      // Las existencias van **después** de que el producto esté guardado y fuera de su
      // transacción, no dentro: `StockService.apply` abre la suya para tomar el bloqueo pesimista
      // sobre la fila del ingrediente, y meterla dentro de otra mantendría ese cerrojo durante
      // toda la fila y rompería la regla de avisar solo después de confirmar.
      //
      // Lo que se pierde es que una fila pueda quedar con el producto creado y el stock sin poner
      // si el proceso muere justo en medio. Es recuperable con lo mismo que recupera todo lo
      // demás: volver a pasar el archivo, que fija el stock al mismo número.
      if (quiereStock) await this.aplicarStock(resultado.product.id, row, ctx.user.sub);

      // Un producto recién creado entra al índice. Es lo que hace que un nombre repetido en **otra
      // tanda** —donde el cliente ya no puede verlo— se actualice en vez de duplicarse.
      ctx.porProducto.set(clave, { id: resultado.product.id, name: resultado.product.name });

      return {
        line: row.line,
        name: row.name,
        status: resultado.status,
        productId: resultado.product.id,
      };
    } catch (err) {
      // Ni un fallo de fila tumba la tanda. El motivo técnico va al log con su requestId; al
      // usuario se le devuelve una frase que pueda leer.
      this.logger.warn({
        event: 'menu:import-row-failed',
        line: row.line,
        error: err instanceof Error ? err.message : String(err),
      });
      return fallo('No se pudo guardar esta línea. Revisa sus datos.');
    }
  }

  /**
   * Las existencias de la fila.
   *
   * Nunca se escribe `ingredients.current_stock` a mano: el stock va como un ajuste, igual que en
   * el resto del sistema, y lo que se registra es **la diferencia**.
   *
   * Pero si el número no cambió, aquí **no se escribe nada**, y esa es una diferencia deliberada
   * con el «ahora tengo N» de la pantalla. Allí un delta de cero sí se guarda —«conté y sigue
   * habiendo doce» es un hecho, y saber quién lo confirmó y cuándo vale más que la fila que se
   * ahorra—. Aquí no hay nadie confirmando nada: es el mismo archivo otra vez, y la recuperación
   * de una importación a medias **es** volver a pasarlo. Sin esta comprobación, reintentarla
   * llenaría el libro mayor de ajustes de cantidad cero, que es justo lo que vuelve inútil un
   * historial.
   */
  private async aplicarStock(
    productId: string,
    row: ImportProductRowDto,
    userId: string,
  ): Promise<void> {
    if (row.minimumStock !== undefined) {
      await this.productStock.setMinimum(productId, row.minimumStock);
    }
    if (row.stock !== undefined) {
      const actual = await this.productStock.currentStockOf(productId);
      if (actual === null || actual !== row.stock) {
        await this.productStock.setStock(
          productId,
          { newStock: row.stock, reasonCode: 'count', note: 'Importación de catálogo' },
          userId,
        );
      }
    }
  }

  /**
   * Las filas de la plantilla: una por categoría existente, con el vocabulario que el lector
   * acepta, para que la plantilla **siempre case con lo que el importador entiende**.
   */
  async templateRows(): Promise<Record<string, string>[]> {
    const categorias = await this.categories.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
      take: 10,
    });
    const nombres = categorias.length > 0 ? categorias.map((c) => c.name) : ['Sin categoría'];
    return nombres.map((categoria, i) => ({
      nombre: i === 0 ? 'BORRA ESTA FILA (ejemplo)' : `Producto de ejemplo ${i + 1}`,
      descripcion: '',
      precio: '0.00',
      categoria,
      estacion: 'cocina',
      stock: '',
      stock_minimo: '',
      activo: 'si',
    }));
  }

  /** El catálogo actual, en el mismo formato que la importación acepta. */
  async exportRows(): Promise<Record<string, string>[]> {
    const productos = await this.products.find({
      relations: { category: true },
      order: { name: 'ASC' },
    });
    return productos.map((p) => ({
      nombre: p.name,
      descripcion: p.description ?? '',
      precio: Number(p.price).toFixed(2),
      categoria: p.category?.name ?? '',
      estacion: ESTACION_LEGIBLE[p.station] ?? p.station,
      stock: '',
      stock_minimo: '',
      activo: p.isActive ? 'si' : 'no',
    }));
  }
}

/** Se exporta en el idioma en que se importa, para que la ida y vuelta sea exacta. */
const ESTACION_LEGIBLE: Record<string, string> = {
  kitchen: 'cocina',
  bar: 'barra',
  immediate: 'inmediato',
};
