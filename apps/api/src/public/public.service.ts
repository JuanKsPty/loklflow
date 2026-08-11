import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RestaurantTable } from '../tables/entities/table.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../menu/products.service';
import { CategoriesService } from '../menu/categories.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import type { Product } from '../menu/entities/product.entity';
import { deriveGuestSecret, signGuestToken, verifyGuestToken } from './guest-token';
import type { PublicCreateOrderDto } from './dto/public-create-order.dto';
import type {
  PublicMenuDto,
  PublicOrderCreatedDto,
  PublicOrderStatusDto,
  PublicProductDto,
} from './dto/public-menu.dto';

/** Estados en los que una mesa acepta que un cliente pida desde su QR. */
const ORDERABLE_TABLE_STATUSES = new Set(['available', 'occupied']);

/** Estados en que un pedido sigue vivo, para contar cuántos hay abiertos por mesa. */
const OPEN_STATUSES = ['pending', 'preparing', 'ready', 'delivered'];

/**
 * Cuántos pedidos por QR puede tener una mesa a la vez.
 *
 * Cinco cubre «cada comensal pide desde su teléfono» y acota el destrozo de un código filtrado: sin
 * tope, quien tenga la foto de una hoja puede llenar la cocina de comandas para una mesa vacía.
 */
const MAX_OPEN_QR_ORDERS_PER_TABLE = 5;

@Injectable()
export class PublicService {
  private readonly guestSecret: string;

  constructor(
    @InjectRepository(RestaurantTable) private tablesRepo: Repository<RestaurantTable>,
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    private readonly orders: OrdersService,
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
    private readonly businessConfig: BusinessConfigService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.guestSecret = deriveGuestSecret(config.get<string>('jwt.secret')!);
  }

  /**
   * El menú que ve un cliente, en **una** respuesta.
   *
   * Una sola petición y no tres: el teléfono está en una conexión mala, y así «este QR no vale» es
   * un único 404 en lugar de tres respuestas que hay que reconciliar en pantalla.
   */
  async menuFor(qrCode: string): Promise<PublicMenuDto> {
    const table = await this.tableByQr(qrCode);
    const business = await this.businessConfig.get();
    const now = new Date();

    // El filtro por horario y por activo se aplica **en el servidor**: el menú del teléfono puede
    // llevar una hora abierto, y un cliente hostil manda lo que quiera.
    const visibleProducts = await this.products.findAll({
      activeOnly: true,
      availableAt: now,
      timeZone: business.timezone,
    });

    const categories = (await this.categories.findAll()).filter((c) => c.isActive);
    const categoryIds = new Set(categories.map((c) => c.id));

    // Un producto cuya categoría está inactiva no se enseña: la categoría es la que decide si esa
    // parte del menú está en servicio.
    const products = visibleProducts.filter(
      (p) => p.categoryId === null || categoryIds.has(p.categoryId),
    );

    const withProducts = new Set(products.map((p) => p.categoryId));

    return {
      business: {
        name: business.businessName,
        logoUrl: business.logoUrl,
        currency: business.currency,
        taxRate: Number(business.taxRate),
      },
      table: {
        id: table.id,
        number: table.number,
        sectorName: table.sector?.name ?? null,
        acceptsOrders: this.acceptsOrders(table),
      },
      // Una categoría vacía se cae: una pestaña «Postres» sin nada dentro se lee como una
      // aplicación rota, no como una carta sin postres.
      categories: categories
        .filter((c) => withProducts.has(c.id))
        .map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          sortOrder: c.sortOrder,
        })),
      products: products.map((p) => this.toPublicProduct(p)),
      serverTime: now.toISOString(),
    };
  }

  /**
   * Crea el pedido de un cliente.
   *
   * Compone `OrdersService.create` en lugar de reimplementarlo: de ahí salen gratis la
   * idempotencia, el número por secuencia, los totales calculados en el servidor, la ocupación de
   * la mesa y el aviso a Cocina. Y `orders.service.ts` no crece, que ya son 486 líneas.
   */
  async createOrder(qrCode: string, dto: PublicCreateOrderDto): Promise<PublicOrderCreatedDto> {
    const table = await this.tableByQr(qrCode);

    // 1. La mesa tiene que estar recibiendo pedidos. Es lo que impide pedir desde el aparcamiento
    //    con una foto del QR, y lo que respeta una mesa reservada o en mantenimiento.
    if (!this.acceptsOrders(table)) {
      throw new ConflictException('Esta mesa no está recibiendo pedidos ahora mismo.');
    }

    // 2. Tope de pedidos vivos por mesa.
    const openForTable = await this.ordersRepo.count({
      where: { tableId: table.id, source: 'customer_qr', status: In(OPEN_STATUSES) },
    });
    if (openForTable >= MAX_OPEN_QR_ORDERS_PER_TABLE) {
      throw new ConflictException(
        'Esta mesa ya tiene varios pedidos en marcha. Avisa a un mesero para pedir más.',
      );
    }

    // 3. Todo lo pedido tiene que estar disponible **ahora**, revalidado en el servidor: el menú
    //    del teléfono puede tener una hora, y el cuerpo de la petición lo escribe quien quiera.
    //    Esto además da el corte por horario de servicio sin ninguna migración: fuera de horas no
    //    hay productos disponibles y el pedido se rechaza.
    const business = await this.businessConfig.get();
    const available = await this.products.findAll({
      activeOnly: true,
      availableAt: new Date(),
      timeZone: business.timezone,
    });
    const availableIds = new Set(available.map((p) => p.id));

    const unavailable = dto.items.filter((item) => !availableIds.has(item.productId));
    if (unavailable.length > 0) {
      throw new ConflictException(
        'Alguno de los productos ya no está disponible. Vuelve a cargar el menú.',
      );
    }

    // Los precios los pone el servidor desde el catálogo (`orders.service.ts`), nunca el cuerpo de
    // la petición. Aquí no se manda ningún importe, y el int-spec lo afirma para que un refactor
    // no lo pueda regresar.
    const order = await this.orders.create(
      {
        tableId: table.id,
        label: dto.customerName?.trim() || undefined,
        notes: dto.notes,
        source: 'customer_qr',
        items: dto.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          modifierOptionIds: item.modifierOptionIds,
        })),
      },
      // Sin mesero: el pedido no lo tomó nadie del personal. `DATA_MODEL.md` lo dice desde el
      // principio y hasta ahora `create` escribía el `waiterId` de quien firmara la petición.
      null,
    );

    return {
      order: this.toPublicStatus(order),
      trackingToken: signGuestToken(this.jwt, this.guestSecret, {
        typ: 'guest_order',
        orderId: order.id,
        tableId: table.id,
      }),
    };
  }

  /**
   * El estado del pedido, para el cliente que lo hizo.
   *
   * **No recibe ningún identificador**: sale del pase firmado. Así no hay nada que enumerar, ni
   * un id en la barra de direcciones, ni en el historial del navegador, ni en el `Referer`, ni en
   * las líneas de acceso que escribe `LOG_HTTP`.
   */
  async orderByToken(token: string | undefined): Promise<PublicOrderStatusDto> {
    const { orderId } = verifyGuestToken(this.jwt, this.guestSecret, token);
    const order = await this.orders.findOne(orderId);
    return this.toPublicStatus(order);
  }

  private async tableByQr(qrCode: string): Promise<RestaurantTable> {
    const table = await this.tablesRepo.findOne({
      where: { qrCode },
      relations: { sector: true },
    });
    // El mismo 404 para «no existe» y para «está desactivada»: distinguirlos le diría a quien
    // sondea que el código era bueno.
    if (!table || !table.isActive) {
      throw new NotFoundException('Este código no corresponde a ninguna mesa');
    }
    return table;
  }

  private acceptsOrders(table: RestaurantTable): boolean {
    return table.isActive && ORDERABLE_TABLE_STATUSES.has(table.status);
  }

  private toPublicProduct(product: Product): PublicProductDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      // `product.modifiers` llega con sus opciones porque `ProductsService.findAll` las carga
      // anidadas. Sin ellas un grupo obligatorio llegaría vacío y el producto no se podría pedir.
      modifiers: (product.modifiers ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        isRequired: m.isRequired,
        allowMultiple: m.allowMultiple,
        minSelections: m.minSelections,
        maxSelections: m.maxSelections,
        options: (m.options ?? [])
          .filter((o) => o.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o) => ({
            id: o.id,
            name: o.name,
            priceAdjustment: Number(o.priceAdjustment),
            isDefault: o.isDefault,
          })),
      })),
    };
  }

  private toPublicStatus(order: Order): PublicOrderStatusDto {
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      tableNumber: order.table?.number ?? null,
      items: (order.items ?? []).map((item) => ({
        name: item.product?.name ?? 'Producto',
        quantity: item.quantity,
        status: item.status,
        notes: item.notes,
        modifiers: (item.modifiers ?? []).map((m) => m.modifierOption?.name ?? '').filter(Boolean),
      })),
      subtotal: Number(order.subtotal),
      total: Number(order.total),
    };
  }
}
