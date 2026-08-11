import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import type { PaymentMethod } from './payment-method.constants';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { isConcurrentWriteConflict } from '../common/write-conflict';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ShiftsService } from '../shifts/shifts.service';
import { AuditService } from '../audit/audit.service';

const EPSILON = 0.001;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    private readonly orders: OrdersService,
    private readonly realtime: RealtimeGateway,
    private readonly shifts: ShiftsService,
    private readonly audit: AuditService,
  ) {}

  async summary(orderId: string) {
    const order = await this.orders.findOne(orderId);
    const payments = order.payments ?? [];
    const paid = Number(payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2));
    const remaining = Number(Math.max(0, order.total - paid).toFixed(2));
    return { total: order.total, paid, remaining, payments };
  }

  async addPayment(orderId: string, dto: CreatePaymentDto, userId: string) {
    // Antes que nada, y antes incluso de mirar si la cuenta está cerrada: un pago reenviado
    // tiene que devolver el estado actual, no un error. La comprobación va primero porque
    // el propio pago original puede haber cerrado la cuenta, y entonces el reintento
    // chocaría con «la cuenta ya está cerrada» — un fallo falso que atascaría la cola.
    if (dto.clientRequestId) {
      const already = await this.paymentsRepo.findOne({
        where: { clientRequestId: dto.clientRequestId },
      });
      if (already) return this.summary(already.orderId);
    }

    const order = await this.orders.findOne(orderId);
    if (order.status === 'closed' || order.status === 'cancelled') {
      throw new BadRequestException('La cuenta ya está cerrada o cancelada');
    }
    // Una cuenta fusionada no se cobra por sí misma: su trabajo está en la principal y su total es
    // 0. Sin esta comprobación, un enlace viejo o una pantalla sin refrescar dejarían registrar un
    // pago contra una cuenta que ningún listado muestra — dinero que no cuadra con nada.
    if (order.mergedIntoOrderId) {
      throw new BadRequestException(
        'Esta cuenta se fusionó en otra. Cobra la cuenta principal.',
      );
    }

    const shift = await this.shifts.currentForUser(userId);
    if (!shift) {
      throw new BadRequestException('No hay un turno de caja abierto. Abre tu turno para cobrar.');
    }

    const paid = Number((order.payments ?? []).reduce((s, p) => s + Number(p.amount), 0).toFixed(2));
    const remaining = Number((order.total - paid).toFixed(2));
    if (dto.amount > remaining + EPSILON) {
      throw new BadRequestException(`El monto excede el restante (${remaining.toFixed(2)})`);
    }

    const payment = await this.savePayment({
      orderId,
      method: dto.method,
      amount: dto.amount,
      reference: dto.reference ?? null,
      clientRequestId: dto.clientRequestId ?? null,
      processedBy: userId,
      shiftId: shift.id,
    });

    // Otra petición idéntica ganó la carrera: el cobro ya está registrado y lo que toca devolver
    // es el estado de la cuenta, no un error ni un segundo cobro.
    if (payment === null) return this.summary(orderId);

    // Auditado aquí porque el handler devuelve el resumen de la cuenta, sin el id del
    // pago: el interceptor no podría identificar el movimiento registrado.
    await this.audit.createLog({
      userId,
      action: 'payment.recorded',
      entityType: 'payment',
      entityId: payment.id,
      newValue: {
        orderId,
        orderNumber: order.orderNumber,
        method: payment.method,
        amount: payment.amount,
        reference: payment.reference,
        shiftId: shift.id,
      },
    });

    const newPaid = Number((paid + dto.amount).toFixed(2));
    if (newPaid >= order.total - EPSILON) {
      await this.orders.closeFromPayment(orderId, userId);
    } else {
      // Pago parcial: avisar a las vistas (POS, mesero) que la cuenta cambió.
      this.realtime.emitOrder({
        type: 'status',
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableId: order.tableId,
        status: order.status,
      });
    }

    return this.summary(orderId);
  }

  /**
   * Inserta el cobro, o devuelve `null` si otra petición idéntica lo insertó primero.
   *
   * La comprobación de `clientRequestId` de arriba es un **read-then-write**, y entre la lectura y
   * la inserción cabe otra petición: un doble toque en «Registrar pago», o el reintento automático
   * del cliente solapándose con el original. El índice único `idx_payments_client_request_id` cierra
   * la ventana, pero sin esto la traducía a un **500 sobre la pantalla de cobro**, que es el peor
   * sitio del producto para un error sin explicación.
   *
   * Sin `clientRequestId` no hay nada que deduplicar: ahí un conflicto es un problema de verdad y
   * se propaga.
   */
  private async savePayment(data: {
    orderId: string;
    method: PaymentMethod;
    amount: number;
    reference: string | null;
    clientRequestId: string | null;
    processedBy: string;
    shiftId: string;
  }): Promise<Payment | null> {
    try {
      return await this.paymentsRepo.save(this.paymentsRepo.create(data));
    } catch (err) {
      if (data.clientRequestId && isConcurrentWriteConflict(err)) {
        const winner = await this.paymentsRepo.findOne({
          where: { clientRequestId: data.clientRequestId },
        });
        if (winner) return null;
      }
      throw err;
    }
  }
}
