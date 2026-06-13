import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationsRepo: Repository<Reservation>,
  ) {}

  findAll() {
    return this.reservationsRepo.find({
      relations: { table: true },
      order: { reservedAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const reservation = await this.reservationsRepo.findOne({
      where: { id },
      relations: { table: true },
    });
    if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);
    return reservation;
  }

  async create(dto: CreateReservationDto, createdBy: string) {
    const reservation = this.reservationsRepo.create({
      tableId: dto.tableId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone ?? null,
      partySize: dto.partySize,
      reservedAt: new Date(dto.reservedAt),
      notes: dto.notes ?? null,
      status: dto.status ?? 'pending',
      createdBy,
    });
    const saved = await this.reservationsRepo.save(reservation);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateReservationDto) {
    const reservation = await this.findOne(id);

    if (dto.tableId !== undefined) reservation.tableId = dto.tableId;
    if (dto.customerName !== undefined) reservation.customerName = dto.customerName;
    if (dto.customerPhone !== undefined) reservation.customerPhone = dto.customerPhone ?? null;
    if (dto.partySize !== undefined) reservation.partySize = dto.partySize;
    if (dto.reservedAt !== undefined) reservation.reservedAt = new Date(dto.reservedAt);
    if (dto.notes !== undefined) reservation.notes = dto.notes ?? null;
    if (dto.status !== undefined) reservation.status = dto.status;

    await this.reservationsRepo.save(reservation);
    return this.findOne(id);
  }

  async remove(id: string) {
    const reservation = await this.findOne(id);
    await this.reservationsRepo.remove(reservation);
  }
}
