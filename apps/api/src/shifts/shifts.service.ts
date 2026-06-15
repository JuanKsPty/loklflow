import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { Payment } from '../payments/entities/payment.entity';
import { PAYMENT_METHODS, type PaymentMethod } from '../payments/payment-method.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift) private readonly shiftsRepo: Repository<Shift>,
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Turno abierto del usuario, o null. */
  currentForUser(userId: string) {
    return this.shiftsRepo.findOne({ where: { openedBy: userId, status: 'open' } });
  }

  async openShift(userId: string, dto: OpenShiftDto) {
    const existing = await this.currentForUser(userId);
    if (existing) {
      throw new BadRequestException('Ya tienes un turno de caja abierto');
    }
    const shift = await this.shiftsRepo.save(
      this.shiftsRepo.create({
        openedBy: userId,
        openingCash: dto.openingCash,
        notes: dto.notes ?? null,
        status: 'open',
      }),
    );
    this.realtime.emitShift(userId);
    return this.summary(shift.id);
  }

  async closeShift(userId: string, shiftId: string, dto: CloseShiftDto) {
    const shift = await this.shiftsRepo.findOne({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    if (shift.openedBy !== userId) {
      throw new BadRequestException('Solo puedes cerrar tu propio turno');
    }
    if (shift.status !== 'open') {
      throw new BadRequestException('El turno ya está cerrado');
    }

    const totalSales = await this.totalSalesOf(shiftId);
    shift.status = 'closed';
    shift.closedBy = userId;
    shift.closedAt = new Date();
    shift.closingCash = dto.closingCash;
    shift.totalSales = totalSales;
    if (dto.notes !== undefined) shift.notes = dto.notes;
    await this.shiftsRepo.save(shift);

    this.realtime.emitShift(userId);
    return this.summary(shiftId);
  }

  listForUser(userId: string) {
    return this.shiftsRepo.find({
      where: { openedBy: userId },
      order: { openedAt: 'DESC' },
      take: 50,
    });
  }

  async summary(shiftId: string) {
    const shift = await this.shiftsRepo.findOne({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Turno no encontrado');

    const payments = await this.paymentsRepo.find({ where: { shiftId } });
    const byMethod = PAYMENT_METHODS.reduce(
      (acc, method) => {
        acc[method] = 0;
        return acc;
      },
      {} as Record<PaymentMethod, number>,
    );
    for (const p of payments) {
      byMethod[p.method] = Number((byMethod[p.method] + Number(p.amount)).toFixed(2));
    }

    const totalSales = Number(
      PAYMENT_METHODS.reduce((sum, m) => sum + byMethod[m], 0).toFixed(2),
    );
    const cashSales = byMethod.cash;
    const expectedCash = Number((shift.openingCash + cashSales).toFixed(2));
    const countedCash = shift.closingCash;
    const difference =
      countedCash === null ? null : Number((countedCash - expectedCash).toFixed(2));

    return {
      shift,
      byMethod,
      totalSales,
      cashSales,
      expectedCash,
      countedCash,
      difference,
      paymentsCount: payments.length,
    };
  }

  private async totalSalesOf(shiftId: string) {
    const payments = await this.paymentsRepo.find({ where: { shiftId } });
    return Number(payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2));
  }
}
