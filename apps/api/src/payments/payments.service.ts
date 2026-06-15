import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const EPSILON = 0.001;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    private readonly orders: OrdersService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async summary(orderId: string) {
    const order = await this.orders.findOne(orderId);
    const payments = order.payments ?? [];
    const paid = Number(payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2));
    const remaining = Number(Math.max(0, order.total - paid).toFixed(2));
    return { total: order.total, paid, remaining, payments };
  }

  async addPayment(orderId: string, dto: CreatePaymentDto, userId: string) {
    const order = await this.orders.findOne(orderId);
    if (order.status === 'closed' || order.status === 'cancelled') {
      throw new BadRequestException('La cuenta ya está cerrada o cancelada');
    }

    const paid = Number((order.payments ?? []).reduce((s, p) => s + Number(p.amount), 0).toFixed(2));
    const remaining = Number((order.total - paid).toFixed(2));
    if (dto.amount > remaining + EPSILON) {
      throw new BadRequestException(`El monto excede el restante (${remaining.toFixed(2)})`);
    }

    await this.paymentsRepo.save(
      this.paymentsRepo.create({
        orderId,
        method: dto.method,
        amount: dto.amount,
        reference: dto.reference ?? null,
        processedBy: userId,
      }),
    );

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
}
