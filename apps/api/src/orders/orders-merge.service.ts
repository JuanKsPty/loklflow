import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrdersService } from './orders.service';
import { canMerge, type MergeCandidate } from './order-merge';
import { computeTotals } from './order-totals';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TablesService } from '../tables/tables.service';
import { AuditService } from '../audit/audit.service';
import type { OrderStatus } from './order-status.constants';

const OPEN_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered'];

/**
 * Fusionar y deshacer cuentas.
 *
 * **Servicio aparte y no un método más de `OrdersService`**, que ya son casi 500 líneas y es el
 * archivo más tocado del backend. Aquí no se reimplementa nada suyo: los totales salen de
 * `computeTotals`, las reglas de `canMerge`, y la lectura de `OrdersService.findOne`.
 */
@Injectable()
export class OrdersMergeService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemsRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly orders: OrdersService,
    private readonly tables: TablesService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  /**
   * Mueve los ítems de varias cuentas a una sola.
   *
   * Todo en una transacción: mover líneas a medias dejaría una comanda partida entre dos cuentas y
   * ningún camino para recomponerla.
   */
  async merge(targetId: string, sourceIds: string[], userId: string) {
    if (sourceIds.includes(targetId)) {
      throw new BadRequestException('Una cuenta no se puede fusionar consigo misma.');
    }

    const freedTables = await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const itemsRepo = manager.getRepository(OrderItem);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const target = await this.loadForMerge(ordersRepo, targetId);
      const sources = await Promise.all(
        sourceIds.map((id) => this.loadForMerge(ordersRepo, id)),
      );

      // Se comprueban **todas** antes de mover nada: una fusión que aplica la mitad y falla en la
      // otra dejaría al mesero sin saber qué quedó dónde.
      for (const src of sources) {
        const verdict = canMerge(this.toCandidate(src), this.toCandidate(target));
        if (!verdict.ok) throw new BadRequestException(verdict.reason);
      }

      // Las líneas conservan su id, así que un ticket ya impreso en cocina sigue identificando lo
      // mismo. `original_order_id` guarda de dónde venían, que es lo que permite deshacer exacto.
      await itemsRepo
        .createQueryBuilder()
        .update(OrderItem)
        .set({ orderId: targetId, originalOrderId: () => '"order_id"' })
        .where('order_id IN (:...ids)', { ids: sourceIds })
        .execute();

      for (const src of sources) {
        src.mergedIntoOrderId = targetId;
        await ordersRepo.save(src);
      }

      await this.recalc(ordersRepo, itemsRepo, targetId);
      for (const src of sources) await this.recalc(ordersRepo, itemsRepo, src.id);

      // El único rastro duradero dentro de la propia cuenta. `fromStatus === toStatus` a propósito:
      // no hubo transición, y fingir una ensuciaría las métricas de tiempos.
      await historyRepo.save(
        Object.assign(new OrderStatusHistory(), {
          orderId: targetId,
          fromStatus: target.status,
          toStatus: target.status,
          changedBy: userId,
          notes: `Fusionada con ${sources.map((s) => `#${s.orderNumber}`).join(', ')}`,
        }),
      );

      // Las mesas de las cuentas origen: si no les queda nada abierto, quedan libres. Es el
      // resultado visible de la operación —juntar la 4 y la 5 deja una de las dos libre— y lo más
      // fácil de olvidar.
      const candidates = [...new Set(sources.map((s) => s.tableId).filter(Boolean))] as string[];
      const freed: string[] = [];
      const targetTableId = target.tableId;
      for (const tableId of candidates) {
        if (tableId === targetTableId) continue;
        const open = await ordersRepo.count({
          where: { tableId, status: In(OPEN_STATUSES), mergedIntoOrderId: IsNull() },
        });
        if (open === 0) freed.push(tableId);
      }
      return {
        freed,
        sources: sources.map((s) => ({ id: s.id, orderNumber: s.orderNumber })),
      };
    });

    // Fuera de la transacción: liberar una mesa emite un evento y llama a otro servicio, y nada de
    // eso debe poder revertir el movimiento de las líneas.
    for (const tableId of freedTables.freed) {
      try {
        await this.tables.updateStatus(tableId, 'available');
      } catch {
        // best-effort, igual que en `maybeFreeTable`
      }
    }

    const result = await this.orders.findOne(targetId);
    this.realtime.emitOrder({
      type: 'status',
      orderId: result.id,
      orderNumber: result.orderNumber,
      tableId: result.tableId,
      status: result.status,
    });
    // También se emite por cada cuenta origen: las pantallas la tienen en su copia local y
    // `findAll` ha dejado de devolverla, así que sin evento se quedarían mostrándola abierta hasta
    // el siguiente refresco completo. No se inventa un estado `merged` —no existe— porque el
    // cliente solo necesita saber que esa cuenta cambió.
    for (const src of freedTables.sources) {
      this.realtime.emitOrder({ type: 'status', orderId: src.id, orderNumber: src.orderNumber });
    }

    await this.audit.createLog({
      userId,
      action: 'order.merged',
      entityType: 'order',
      entityId: targetId,
      newValue: {
        targetOrderNumber: result.orderNumber,
        sourceOrderNumbers: freedTables.sources.map((s) => s.orderNumber),
        total: result.total,
      },
    });

    return result;
  }

  /**
   * Devuelve una cuenta fusionada a su estado anterior.
   *
   * Exacto gracias a `original_order_id`: se mueven de vuelta **solo** las líneas que vinieron de
   * esta cuenta, no todas las que ahora tiene la destino.
   */
  async unmerge(sourceId: string, userId: string) {
    const targetId = await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const itemsRepo = manager.getRepository(OrderItem);

      const source = await ordersRepo.findOne({ where: { id: sourceId } });
      if (!source) throw new NotFoundException(`Order ${sourceId} not found`);
      if (!source.mergedIntoOrderId) {
        throw new BadRequestException('Esta cuenta no está fusionada.');
      }
      const target = await ordersRepo.findOne({ where: { id: source.mergedIntoOrderId } });
      if (!target) throw new NotFoundException('La cuenta principal ya no existe.');

      // Si la destino ya se cobró, deshacer le quitaría líneas que están dentro de un pago.
      if (target.status === 'closed' || target.status === 'cancelled') {
        throw new BadRequestException(
          `La cuenta #${target.orderNumber} ya está cerrada: no se puede deshacer la fusión.`,
        );
      }

      await itemsRepo
        .createQueryBuilder()
        .update(OrderItem)
        .set({ orderId: sourceId, originalOrderId: null })
        .where('original_order_id = :sourceId', { sourceId })
        .execute();

      source.mergedIntoOrderId = null;
      await ordersRepo.save(source);

      await this.recalc(ordersRepo, itemsRepo, sourceId);
      await this.recalc(ordersRepo, itemsRepo, target.id);

      return target.id;
    });

    const restored = await this.orders.findOne(sourceId);

    // La mesa vuelve a estar ocupada: tiene otra vez una cuenta abierta.
    if (restored.tableId) {
      try {
        await this.tables.updateStatus(restored.tableId, 'occupied');
      } catch {
        // best-effort
      }
    }

    for (const id of [sourceId, targetId]) {
      const order = await this.orders.findOne(id);
      this.realtime.emitOrder({
        type: 'status',
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableId: order.tableId,
        status: order.status,
      });
    }

    await this.audit.createLog({
      userId,
      action: 'order.unmerged',
      entityType: 'order',
      entityId: sourceId,
      newValue: { orderNumber: restored.orderNumber, total: restored.total },
    });

    return restored;
  }

  private async loadForMerge(repo: Repository<Order>, id: string): Promise<Order> {
    const order = await repo.findOne({ where: { id }, relations: { payments: true } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  private toCandidate(order: Order): MergeCandidate {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      tableId: order.tableId,
      mergedIntoOrderId: order.mergedIntoOrderId,
      paidAmount: (order.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
      discountAmount: Number(order.discountAmount),
      tipAmount: Number(order.tipAmount),
    };
  }

  /** Rehace subtotal y total con las líneas que la cuenta tiene **ahora**. */
  private async recalc(
    ordersRepo: Repository<Order>,
    itemsRepo: Repository<OrderItem>,
    orderId: string,
  ) {
    const order = await ordersRepo.findOne({ where: { id: orderId } });
    if (!order) return;
    const items = await itemsRepo.find({ where: { orderId }, relations: { modifiers: true } });
    const { subtotal, total } = computeTotals(items, order.discountAmount, order.tipAmount);
    order.subtotal = subtotal;
    order.total = total;
    await ordersRepo.save(order);
  }

  /** Para el guard de otros servicios: si esta cuenta se fusionó, en cuál. */
  async mergedIntoOf(orderId: string): Promise<{ orderNumber: number } | null> {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId, mergedIntoOrderId: Not(IsNull()) },
      relations: { mergedInto: true },
    });
    return order?.mergedInto ? { orderNumber: order.mergedInto.orderNumber } : null;
  }
}
