import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, MoreThan, Not, QueryFailedError, Repository } from 'typeorm';
import { Product } from '../menu/entities/product.entity';
import { ModifierOption } from '../menu/entities/modifier-option.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemModifier } from './entities/order-item-modifier.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { ALLOWED_TRANSITIONS, type OrderStatus } from './order-status.constants';
import { computeTotals, itemSubtotal } from './order-totals';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import {
  ORDERS_DEFAULT_TAKE,
  ORDERS_MAX_TAKE,
  QueryOrdersDto,
} from './dto/query-orders.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { TablesService } from '../tables/tables.service';
import { AuditService } from '../audit/audit.service';

const ORDER_RELATIONS = {
  table: true,
  items: { product: true, modifiers: true },
  statusHistory: true,
  payments: true,
};

const OPEN_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered'];

/** Igual que en PaymentsService y DiscountsService: tolerancia de centavos al comparar importes. */
const MONEY_EPSILON = 0.001;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemsRepo: Repository<OrderItem>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ModifierOption) private optionsRepo: Repository<ModifierOption>,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly tables: TablesService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Listado de órdenes, siempre acotado.
   *
   * Antes no tenía ni `take` ni filtro de apertura, así que devolvía todas las órdenes de la
   * historia del negocio con sus relaciones en eager. El tope por defecto es deliberado: una
   * respuesta acotada de más se nota y se corrige, una sin acotar se degrada en silencio a
   * medida que crece el histórico.
   */
  findAll(filters?: QueryOrdersDto) {
    const where: FindOptionsWhere<Order> = {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.tableId ? { tableId: filters.tableId } : {}),
      // `open` y `status` son compatibles: si llegan los dos, manda el estado concreto.
      ...(filters?.open && !filters.status ? { status: In(OPEN_STATUSES) } : {}),
      ...(filters?.since ? { updatedAt: MoreThan(new Date(filters.since)) } : {}),
    };

    return this.ordersRepo.find({
      where,
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
      take: Math.min(filters?.take ?? ORDERS_DEFAULT_TAKE, ORDERS_MAX_TAKE),
      skip: filters?.skip ?? 0,
    });
  }

  async findOne(id: string) {
    const order = await this.ordersRepo.findOne({ where: { id }, relations: ORDER_RELATIONS });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async create(dto: CreateOrderDto, waiterId: string) {
    // El dispositivo puede traer su propio uuid para poder crear la cuenta sin conexión y
    // encolar contra ella («añade ítem», «cobra») antes de que el servidor la conozca. Si
    // ese id ya existe, la petición es un reenvío: se devuelve la orden tal cual, sin
    // repetir efectos —no se vuelve a ocupar la mesa ni se avisa otra vez a cocina.
    //
    // La comprobación es explícita y no una violación de unicidad capturada, porque
    // `save()` con una clave primaria que ya existe **no falla: hace UPDATE**. Confiar en
    // la excepción sobrescribiría la orden en silencio, y con los ítems en cascada además
    // borraría los que se hubieran añadido después.
    if (dto.id) {
      const existing = await this.ordersRepo.findOne({ where: { id: dto.id } });
      if (existing) return this.findOne(existing.id);
    }

    const items: OrderItem[] = [];
    for (const itemDto of dto.items) {
      items.push(await this.buildItem(itemDto));
    }

    const order = this.ordersRepo.create({
      orderNumber: await this.nextOrderNumber(),
      ...(dto.id ? { id: dto.id } : {}),
      label: dto.label ?? null,
      tableId: dto.tableId ?? null,
      waiterId,
      source: dto.source ?? 'staff',
      status: 'pending',
      notes: dto.notes ?? null,
      discountAmount: 0,
      tipAmount: 0,
      items,
      statusHistory: [
        Object.assign(new OrderStatusHistory(), {
          fromStatus: null,
          toStatus: 'pending',
          changedBy: waiterId,
        }),
      ],
    });
    this.applyTotals(order);

    let saved: Order;
    try {
      saved = await this.ordersRepo.save(order);
    } catch (err) {
      // Dos reenvíos simultáneos del mismo id: ambos comprobaron antes de que existiera y
      // ambos insertan. El que pierde recibe una violación de clave primaria, y la respuesta
      // correcta es la orden que acaba de crear el otro, no un error.
      if (dto.id && err instanceof QueryFailedError && /unique|duplicate/i.test(err.message)) {
        return this.findOne(dto.id);
      }
      throw err;
    }
    const result = await this.findOne(saved.id);
    this.emit(result, 'created');
    // Al abrir una cuenta en una mesa, marcarla ocupada (best-effort; emite table:changed).
    if (result.table && result.table.status !== 'occupied') {
      try {
        await this.tables.updateStatus(result.table.id, 'occupied');
      } catch {
        // no bloquea la creación de la orden si falla
      }
    }
    // Solo avisar a Cocina si la orden tiene algún ítem que se prepara en cocina.
    if (result.items.some((i) => i.product?.station === 'kitchen')) {
      void this.notifications.notifyRole('Cocina', {
        type: 'order_new',
        title: `Nueva orden #${result.orderNumber}`,
        body: this.orderLocation(result),
        resourceType: 'order',
        resourceId: result.id,
      });
    }
    return result;
  }

  async addItem(orderId: string, dto: AddItemDto) {
    const order = await this.findOne(orderId);
    // Misma idempotencia que en `create`: si la línea que trae el dispositivo ya está en la
    // cuenta, la operación es un reenvío y no debe volver a sumarla al total.
    if (dto.id && order.items.some((i) => i.id === dto.id)) return order;
    this.assertOpen(order);
    const item = await this.buildItem(dto);
    item.orderId = order.id;
    order.items.push(item);
    this.applyTotals(order);
    await this.ordersRepo.save(order);
    const result = await this.findOne(orderId);
    this.emit(result, 'item');
    return result;
  }

  async updateItem(orderId: string, itemId: string, dto: UpdateItemDto) {
    const order = await this.findOne(orderId);
    this.assertOpen(order);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in order`);

    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.notes !== undefined) item.notes = dto.notes ?? null;
    item.subtotal = itemSubtotal(item.quantity, item.unitPrice, item.modifiers ?? []);

    this.applyTotals(order);
    await this.ordersRepo.save(order);
    const result = await this.findOne(orderId);
    this.emit(result, 'item');
    return result;
  }

  async removeItem(orderId: string, itemId: string) {
    const order = await this.findOne(orderId);
    this.assertOpen(order);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in order`);
    await this.itemsRepo.remove(item);

    const fresh = await this.findOne(orderId);
    this.applyTotals(fresh);
    await this.ordersRepo.save(fresh);
    const result = await this.findOne(orderId);
    this.emit(result, 'item');
    return result;
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto, userId: string) {
    const order = await this.findOne(orderId);
    if (order.status === dto.status) return order;
    if (!ALLOWED_TRANSITIONS[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `Transición no permitida: ${order.status} → ${dto.status}`,
      );
    }
    // Una cuenta no se puede cerrar con saldo pendiente.
    //
    // La regla vive aquí, en el servidor, y no en la interfaz: la vista del mesero pintaba un
    // botón por cada transición permitida, así que en una orden entregada aparecía «Cerrada»
    // y bastaba un toque para que la cuenta saliera de «Cuentas por cobrar» y la mesa se
    // liberara sin haber cobrado. Dinero perdido sin traza. Con la comprobación en el
    // servicio ninguna ruta futura —ni una operación reenviada desde una cola sin conexión—
    // puede saltársela.
    //
    // El cierre legítimo no pasa por aquí: lo hace `closeFromPayment` cuando el último pago
    // salda la cuenta.
    if (dto.status === 'closed') {
      const paid = this.paidOf(order);
      const total = Number(order.total);
      if (paid < total - MONEY_EPSILON) {
        throw new BadRequestException(
          `La cuenta tiene ${(total - paid).toFixed(2)} sin cobrar. ` +
            `Cóbrala para cerrarla, o cancélala si no se va a cobrar.`,
        );
      }
    }
    const history = Object.assign(new OrderStatusHistory(), {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: dto.status,
      changedBy: userId,
      notes: dto.notes ?? null,
    });
    order.status = dto.status;
    order.statusHistory = [...(order.statusHistory ?? []), history];
    await this.ordersRepo.save(order);
    const result = await this.findOne(orderId);
    this.emit(result, 'status');
    if (result.status === 'ready') {
      const payload = {
        type: 'order_ready' as const,
        title: `Orden #${result.orderNumber} lista`,
        body: this.orderLocation(result),
        resourceType: 'order',
        resourceId: result.id,
      };
      if (result.waiterId) void this.notifications.notifyUser(result.waiterId, payload);
      else void this.notifications.notifyRole('Mesero', payload);
    }
    if (result.status === 'closed' || result.status === 'cancelled') {
      await this.maybeFreeTable(result);
    }
    // Solo la cancelación va a la bitácora: el resto del ciclo de vida ya queda en
    // order_status_history. Se registra aquí, después del early-return de arriba, para
    // no anotar un cambio cuando el estado no cambió.
    if (result.status === 'cancelled') {
      await this.audit.createLog({
        userId,
        action: 'order.cancelled',
        entityType: 'order',
        entityId: result.id,
        oldValue: { status: history.fromStatus },
        newValue: {
          status: 'cancelled',
          orderNumber: result.orderNumber,
          total: result.total,
          notes: dto.notes ?? null,
        },
      });
    }
    return result;
  }

  // ---- cobro / cierre ----

  /** Fija la propina y recalcula el total. */
  async setTip(orderId: string, tipAmount: number, _userId: string) {
    const order = await this.findOne(orderId);
    this.assertOpen(order);
    order.tipAmount = Number(tipAmount.toFixed(2));
    this.applyTotals(order);
    await this.ordersRepo.save(order);
    const result = await this.findOne(orderId);
    this.emit(result, 'status');
    return result;
  }

  /**
   * Fija el descuento y recalcula el total. Reemplaza al descuento anterior, no acumula.
   *
   * Si el nuevo total deja la cuenta saldada con lo ya cobrado, cierra la orden y libera
   * la mesa: el cierre normal solo ocurre dentro de `addPayment`, así que sin esto una
   * cuenta saldada por un descuento se quedaría abierta para siempre con la mesa ocupada.
   */
  async setDiscount(orderId: string, discountAmount: number, userId: string) {
    const order = await this.findOne(orderId);
    this.assertOpen(order);
    order.discountAmount = Number(discountAmount.toFixed(2));
    this.applyTotals(order);
    await this.ordersRepo.save(order);

    const saved = await this.findOne(orderId);
    const paid = this.paidOf(saved);
    if (paid > 0 && paid >= Number(saved.total) - MONEY_EPSILON) {
      return this.closeFromPayment(orderId, userId);
    }

    this.emit(saved, 'status');
    return saved;
  }

  /** Cierra la orden tras saldarse el pago (desacoplado del flujo de cocina). */
  async closeFromPayment(orderId: string, userId: string) {
    const order = await this.findOne(orderId);
    if (order.status === 'closed' || order.status === 'cancelled') return order;
    const history = Object.assign(new OrderStatusHistory(), {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: 'closed',
      changedBy: userId,
      notes: 'Cuenta cobrada',
    });
    order.status = 'closed';
    order.statusHistory = [...(order.statusHistory ?? []), history];
    await this.ordersRepo.save(order);
    const result = await this.findOne(orderId);
    this.emit(result, 'status');
    await this.maybeFreeTable(result);
    return result;
  }

  /** Libera la mesa si ya no le quedan cuentas abiertas. */
  private async maybeFreeTable(order: Order) {
    if (!order.tableId) return;
    const open = await this.ordersRepo.count({
      where: { tableId: order.tableId, status: In(OPEN_STATUSES), id: Not(order.id) },
    });
    if (open === 0) {
      try {
        await this.tables.updateStatus(order.tableId, 'available');
      } catch {
        // best-effort
      }
    }
  }

  async updateItemStatus(orderId: string, itemId: string, dto: UpdateItemStatusDto) {
    const order = await this.findOne(orderId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in order`);
    item.status = dto.status;
    await this.itemsRepo.save(item);
    const result = await this.findOne(orderId);
    this.emit(result, 'status');
    return result;
  }

  // ---- helpers ----

  /**
   * Siguiente número de cuenta, de una secuencia de Postgres.
   *
   * Antes era `MAX(order_number) + 1`, con un único reintento si la inserción chocaba. No
   * bastaba: ocho creaciones simultáneas devolvían 500, porque varias leían el mismo máximo,
   * la primera ganaba y los reintentos de las demás volvían a colisionar entre sí. Con dos
   * meseros tomando nota a la vez, la orden se perdía.
   *
   * `nextval` es atómico y no depende de la transacción, así que nunca entrega el mismo
   * valor dos veces. La contrapartida es que un número se «gasta» si la inserción luego
   * falla, y por eso la numeración puede tener huecos: es lo aceptable, porque el problema
   * que resuelve es que dos cuentas distintas compartieran número.
   */
  private async nextOrderNumber(): Promise<number> {
    const [row]: { nextval: string }[] = await this.ordersRepo.query(
      `SELECT nextval('orders_order_number_seq')`,
    );
    return Number(row.nextval);
  }

  /** Suma de los pagos registrados en la cuenta, redondeada a centavos. */
  private paidOf(order: Order): number {
    return Number(
      (order.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2),
    );
  }

  private orderLocation(order: Order): string {
    const place = order.table ? `Mesa ${order.table.number}` : 'Para llevar';
    return order.label ? `${place} · ${order.label}` : place;
  }

  private emit(order: Order, type: 'created' | 'item' | 'status') {
    this.realtime.emitOrder({
      type,
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableId: order.tableId,
      status: order.status,
    });
  }


  private async buildItem(dto: CreateOrderItemDto): Promise<OrderItem> {
    const product = await this.productsRepo.findOne({ where: { id: dto.productId } });
    if (!product) throw new BadRequestException(`Producto ${dto.productId} no existe`);

    const modifiers: OrderItemModifier[] = [];
    if (dto.modifierOptionIds?.length) {
      const options = await this.optionsRepo.find({ where: { id: In(dto.modifierOptionIds) } });
      if (options.length !== dto.modifierOptionIds.length) {
        throw new BadRequestException('Una o más opciones de modificador no existen');
      }
      for (const opt of options) {
        modifiers.push(
          Object.assign(new OrderItemModifier(), {
            modifierOptionId: opt.id,
            priceAdjustment: opt.priceAdjustment,
          }),
        );
      }
    }

    const unitPrice = product.price;
    return Object.assign(new OrderItem(), {
      ...(dto.id ? { id: dto.id } : {}),
      productId: product.id,
      quantity: dto.quantity,
      unitPrice,
      subtotal: itemSubtotal(dto.quantity, unitPrice, modifiers),
      notes: dto.notes ?? null,
      status: 'pending',
      modifiers,
    });
  }

  private applyTotals(order: Order) {
    const { subtotal, total } = computeTotals(
      order.items,
      order.discountAmount,
      order.tipAmount,
    );
    order.subtotal = subtotal;
    order.total = total;
  }

  private assertOpen(order: Order) {
    if (order.status === 'closed' || order.status === 'cancelled') {
      throw new BadRequestException('La orden ya está cerrada o cancelada');
    }
  }
}
