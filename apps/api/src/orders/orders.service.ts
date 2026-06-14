import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Product } from '../menu/entities/product.entity';
import { ModifierOption } from '../menu/entities/modifier-option.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemModifier } from './entities/order-item-modifier.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { ALLOWED_TRANSITIONS, type OrderStatus } from './order-status.constants';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';

const ORDER_RELATIONS = {
  table: true,
  items: { product: true, modifiers: true },
  statusHistory: true,
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemsRepo: Repository<OrderItem>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ModifierOption) private optionsRepo: Repository<ModifierOption>,
  ) {}

  findAll(filters?: { status?: OrderStatus; tableId?: string }) {
    return this.ordersRepo.find({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.tableId ? { tableId: filters.tableId } : {}),
      },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const order = await this.ordersRepo.findOne({ where: { id }, relations: ORDER_RELATIONS });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async create(dto: CreateOrderDto, waiterId: string) {
    const items: OrderItem[] = [];
    for (const itemDto of dto.items) {
      items.push(await this.buildItem(itemDto));
    }

    const order = this.ordersRepo.create({
      orderNumber: await this.nextOrderNumber(),
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

    try {
      const saved = await this.ordersRepo.save(order);
      return this.findOne(saved.id);
    } catch (err) {
      if (err instanceof QueryFailedError && /unique|duplicate/i.test(err.message)) {
        // colisión rara de order_number por concurrencia: reintenta una vez
        order.orderNumber = await this.nextOrderNumber();
        const saved = await this.ordersRepo.save(order);
        return this.findOne(saved.id);
      }
      throw err;
    }
  }

  async addItem(orderId: string, dto: AddItemDto) {
    const order = await this.findOne(orderId);
    this.assertOpen(order);
    const item = await this.buildItem(dto);
    item.orderId = order.id;
    order.items.push(item);
    this.applyTotals(order);
    await this.ordersRepo.save(order);
    return this.findOne(orderId);
  }

  async updateItem(orderId: string, itemId: string, dto: UpdateItemDto) {
    const order = await this.findOne(orderId);
    this.assertOpen(order);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in order`);

    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.notes !== undefined) item.notes = dto.notes ?? null;
    item.subtotal = this.itemSubtotal(item.quantity, item.unitPrice, item.modifiers ?? []);

    this.applyTotals(order);
    await this.ordersRepo.save(order);
    return this.findOne(orderId);
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
    return this.findOne(orderId);
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto, userId: string) {
    const order = await this.findOne(orderId);
    if (order.status === dto.status) return order;
    if (!ALLOWED_TRANSITIONS[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `Transición no permitida: ${order.status} → ${dto.status}`,
      );
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
    return this.findOne(orderId);
  }

  async updateItemStatus(orderId: string, itemId: string, dto: UpdateItemStatusDto) {
    const order = await this.findOne(orderId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in order`);
    item.status = dto.status;
    await this.itemsRepo.save(item);
    return this.findOne(orderId);
  }

  // ---- helpers ----

  private async nextOrderNumber(): Promise<number> {
    const row = await this.ordersRepo
      .createQueryBuilder('o')
      .select('MAX(o.orderNumber)', 'max')
      .getRawOne<{ max: number | null }>();
    return (row?.max ?? 0) + 1;
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
      productId: product.id,
      quantity: dto.quantity,
      unitPrice,
      subtotal: this.itemSubtotal(dto.quantity, unitPrice, modifiers),
      notes: dto.notes ?? null,
      status: 'pending',
      modifiers,
    });
  }

  private itemSubtotal(quantity: number, unitPrice: number, modifiers: OrderItemModifier[]): number {
    const adjustments = modifiers.reduce((sum, m) => sum + Number(m.priceAdjustment), 0);
    return Number(((unitPrice + adjustments) * quantity).toFixed(2));
  }

  private applyTotals(order: Order) {
    const active = order.items.filter((i) => i.status !== 'cancelled');
    const discount = Number(order.discountAmount) || 0;
    const tip = Number(order.tipAmount) || 0;
    order.subtotal = Number(active.reduce((sum, i) => sum + Number(i.subtotal), 0).toFixed(2));
    order.total = Number((order.subtotal - discount + tip).toFixed(2));
  }

  private assertOpen(order: Order) {
    if (order.status === 'closed' || order.status === 'cancelled') {
      throw new BadRequestException('La orden ya está cerrada o cancelada');
    }
  }
}
