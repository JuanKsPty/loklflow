import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from './entities/discount.entity';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { RejectDiscountDto } from './dto/reject-discount.dto';
import { DISCOUNT_MAX_LIMIT, QueryDiscountsDto } from './dto/query-discounts.dto';
import { OrdersService } from '../orders/orders.service';
import { RolesService } from '../roles/roles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import {
  discountAsPercentage,
  percentageAsAmount,
} from '../orders/order-totals';
import type { AuditAction } from '../audit/audit-actions.constants';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { Order } from '../orders/entities/order.entity';

/** Roles que reciben el aviso de un descuento pendiente. */
const APPROVER_ROLES = ['Gerente', 'Administrador'];

/** Igual que en PaymentsService: tolerancia de centavos al comparar importes. */
const EPSILON = 0.001;

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(Discount)
    private readonly repo: Repository<Discount>,
    private readonly orders: OrdersService,
    private readonly roles: RolesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Solicita un descuento. Si el porcentaje cabe en el umbral del rol se aplica al
   * instante; si lo excede queda pendiente de aprobación y no toca el total.
   */
  async request(orderId: string, dto: CreateDiscountDto, actor: JwtPayload) {
    const order = await this.orders.findOne(orderId);
    this.assertDiscountable(order);

    const subtotal = Number(order.subtotal);
    const amount =
      dto.type === 'percentage'
        ? percentageAsAmount(subtotal, dto.value)
        : Number(dto.value.toFixed(2));

    if (dto.type === 'percentage' && dto.value > 100) {
      throw new BadRequestException('El descuento no puede exceder el 100%');
    }
    if (amount <= 0) {
      throw new BadRequestException('El descuento debe ser mayor que cero');
    }
    if (amount > subtotal + EPSILON) {
      throw new BadRequestException(
        `El descuento (${amount.toFixed(2)}) excede el subtotal de la cuenta (${subtotal.toFixed(2)})`,
      );
    }

    // El descuento reemplaza al anterior, no se acumula.
    const paid = this.paidOf(order);
    const newTotal = this.projectedTotal(order, amount);
    if (newTotal < paid - EPSILON) {
      throw new BadRequestException(
        `El descuento dejaría el total (${newTotal.toFixed(2)}) por debajo de lo ya cobrado ` +
          `(${paid.toFixed(2)}). Reduce el descuento o anula los pagos primero.`,
      );
    }

    const percentage = discountAsPercentage(subtotal, amount);
    const threshold = await this.thresholdFor(actor.roleId);
    const autoApproved = percentage <= threshold + EPSILON;

    const discount = await this.repo.save(
      this.repo.create({
        orderId,
        type: dto.type,
        value: Number(dto.value.toFixed(2)),
        amount,
        percentage,
        reason: dto.reason,
        requestedBy: actor.sub,
        requestedByName: actor.name ?? actor.email ?? null,
        status: autoApproved ? 'approved' : 'pending',
        approvedBy: autoApproved ? actor.sub : null,
        approvedByName: autoApproved ? (actor.name ?? actor.email ?? null) : null,
        resolvedAt: autoApproved ? new Date() : null,
      }),
    );

    await this.log(autoApproved ? 'discount.approved' : 'discount.requested', discount, actor, {
      oldValue: { discountAmount: Number(order.discountAmount) },
      newValue: {
        discountAmount: amount,
        percentage,
        type: dto.type,
        value: discount.value,
        reason: dto.reason,
        threshold,
        autoApproved,
      },
    });

    if (autoApproved) {
      await this.applyToOrder(orderId, amount, actor.sub);
      return this.withOrder(discount.id);
    }

    await this.notifyApprovers(discount, order);
    return this.withOrder(discount.id);
  }

  /** Aprueba un pendiente y aplica el importe a la orden. */
  async approve(id: string, actor: JwtPayload) {
    const discount = await this.findPending(id);
    const order = await this.orders.findOne(discount.orderId);
    this.assertDiscountable(order);

    // Se revalida contra el estado actual: la cuenta pudo cambiar desde la solicitud.
    const paid = this.paidOf(order);
    const newTotal = this.projectedTotal(order, discount.amount);
    if (newTotal < paid - EPSILON) {
      throw new BadRequestException(
        `El descuento ya no es aplicable: dejaría el total (${newTotal.toFixed(2)}) por ` +
          `debajo de lo cobrado (${paid.toFixed(2)}).`,
      );
    }
    if (discount.amount > Number(order.subtotal) + EPSILON) {
      throw new BadRequestException(
        'El descuento ya no es aplicable: excede el subtotal actual de la cuenta.',
      );
    }

    discount.status = 'approved';
    discount.approvedBy = actor.sub;
    discount.approvedByName = actor.name ?? actor.email ?? null;
    discount.resolvedAt = new Date();
    await this.repo.save(discount);

    await this.log('discount.approved', discount, actor, {
      oldValue: { status: 'pending', discountAmount: Number(order.discountAmount) },
      newValue: { status: 'approved', discountAmount: discount.amount },
    });

    await this.applyToOrder(discount.orderId, discount.amount, actor.sub);

    // Avisar a quien lo pidió, que puede estar esperando en la caja.
    await this.notifications.notifyUser(discount.requestedBy, {
      type: 'discount_pending',
      title: 'Descuento aprobado',
      body: `Tu descuento de ${discount.amount.toFixed(2)} fue aprobado por ${
        discount.approvedByName ?? 'un supervisor'
      }.`,
      resourceType: 'order',
      resourceId: discount.orderId,
    });

    return this.withOrder(discount.id);
  }

  async reject(id: string, dto: RejectDiscountDto, actor: JwtPayload) {
    const discount = await this.findPending(id);

    discount.status = 'rejected';
    discount.approvedBy = actor.sub;
    discount.approvedByName = actor.name ?? actor.email ?? null;
    discount.resolvedAt = new Date();
    discount.rejectionReason = dto.reason ?? null;
    await this.repo.save(discount);

    await this.log('discount.rejected', discount, actor, {
      oldValue: { status: 'pending' },
      newValue: { status: 'rejected', rejectionReason: dto.reason ?? null },
    });

    await this.notifications.notifyUser(discount.requestedBy, {
      type: 'discount_pending',
      title: 'Descuento rechazado',
      body: dto.reason
        ? `Tu descuento fue rechazado: ${dto.reason}`
        : 'Tu descuento fue rechazado.',
      resourceType: 'order',
      resourceId: discount.orderId,
    });

    return this.withOrder(discount.id);
  }

  async findAll(query: QueryDiscountsDto = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 50), DISCOUNT_MAX_LIMIT);

    const [data, total] = await this.repo.findAndCount({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
      },
      relations: { order: true },
      // Los pendientes más antiguos primero: es una cola de trabajo, no un historial.
      order: query.status === 'pending' ? { createdAt: 'ASC' } : { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total, page, limit };
  }

  findOne(id: string) {
    return this.withOrder(id);
  }

  /** Cuenta de pendientes, para el badge de la bandeja. */
  async pendingCount() {
    const count = await this.repo.count({ where: { status: 'pending' } });
    return { count };
  }

  // ---------------------------------------------------------------- privados

  private async withOrder(id: string) {
    const discount = await this.repo.findOne({
      where: { id },
      relations: { order: true },
    });
    if (!discount) throw new NotFoundException(`Descuento ${id} no encontrado`);
    return discount;
  }

  private async findPending(id: string) {
    const discount = await this.repo.findOne({ where: { id } });
    if (!discount) throw new NotFoundException(`Descuento ${id} no encontrado`);
    if (discount.status !== 'pending') {
      throw new BadRequestException(
        `El descuento ya fue ${discount.status === 'approved' ? 'aprobado' : 'rechazado'}`,
      );
    }
    return discount;
  }

  /** Umbral del rol en porcentaje. Number() defensivo: la columna es decimal. */
  private async thresholdFor(roleId: string): Promise<number> {
    const role = await this.roles.findOne(roleId);
    return Number(role.maxDiscountPercentage) || 0;
  }

  private assertDiscountable(order: Order) {
    if (order.status === 'closed' || order.status === 'cancelled') {
      throw new BadRequestException('La cuenta ya está cerrada o cancelada');
    }
  }

  private paidOf(order: Order): number {
    return Number(
      (order.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2),
    );
  }

  /** Total que tendría la orden con este descuento, sustituyendo al que hubiera. */
  private projectedTotal(order: Order, amount: number): number {
    const subtotal = Number(order.subtotal);
    const tip = Number(order.tipAmount) || 0;
    return Number(Math.max(0, subtotal - amount + tip).toFixed(2));
  }

  private applyToOrder(orderId: string, amount: number, userId: string) {
    return this.orders.setDiscount(orderId, amount, userId);
  }

  private async notifyApprovers(discount: Discount, order: Order) {
    const title = `Descuento pendiente de ${discount.amount.toFixed(2)}`;
    const body =
      `${discount.requestedByName ?? 'Un cajero'} pidió ${discount.percentage}% ` +
      `en la orden #${order.orderNumber}: ${discount.reason}`;

    // notifyRole acepta un solo rol, así que hay una llamada por rol aprobador.
    for (const roleName of APPROVER_ROLES) {
      await this.notifications.notifyRole(roleName, {
        type: 'discount_pending',
        title,
        body: body.slice(0, 500),
        resourceType: 'discount',
        resourceId: discount.id,
      });
    }
  }

  private log(
    action: AuditAction,
    discount: Discount,
    actor: JwtPayload,
    values: { oldValue?: unknown; newValue?: unknown },
  ) {
    return this.audit.createLog({
      userId: actor.sub,
      userName: actor.name ?? actor.email ?? undefined,
      action,
      entityType: 'discount',
      entityId: discount.id,
      ...values,
    });
  }
}
