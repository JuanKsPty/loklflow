import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { RestaurantTable } from './entities/table.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

/**
 * Cuánto se considera que dura una reserva a efectos de solapamiento.
 *
 * No hay una columna de duración —ni hace falta una para esto—: lo que se quiere evitar es que
 * dos familias lleguen a la misma mesa con quince minutos de diferencia. Noventa minutos es el
 * turno habitual de una mesa en un restaurante con servicio a mesa; el gerente siempre puede
 * poner la reserva en otra mesa, que es lo que haría de todos modos.
 */
const RESERVATION_SLOT_MINUTES = 90;

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationsRepo: Repository<Reservation>,
    @InjectRepository(RestaurantTable)
    private tablesRepo: Repository<RestaurantTable>,
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
    const reservedAt = new Date(dto.reservedAt);
    await this.assertTableExists(dto.tableId);
    await this.assertFree(dto.tableId, reservedAt);

    const reservation = this.reservationsRepo.create({
      tableId: dto.tableId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone ?? null,
      partySize: dto.partySize,
      reservedAt,
      notes: dto.notes ?? null,
      status: dto.status ?? 'pending',
      createdBy,
    });
    const saved = await this.reservationsRepo.save(reservation);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateReservationDto) {
    const reservation = await this.findOne(id);

    // Mover una reserva de mesa o de hora vuelve a pasar por las dos comprobaciones: sin esto,
    // el `PATCH` sería la puerta de atrás por la que entra justo lo que `create` rechaza.
    const movedTable = dto.tableId !== undefined && dto.tableId !== reservation.tableId;
    const movedTime =
      dto.reservedAt !== undefined &&
      new Date(dto.reservedAt).getTime() !== reservation.reservedAt.getTime();
    if (movedTable) await this.assertTableExists(dto.tableId!);
    if (movedTable || movedTime) {
      await this.assertFree(
        dto.tableId ?? reservation.tableId,
        dto.reservedAt ? new Date(dto.reservedAt) : reservation.reservedAt,
        id,
      );
    }

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

  /**
   * Sin esto, una mesa inexistente llegaba al `INSERT` y salía como **500** por violación de
   * clave ajena. Un id equivocado en el formulario es un error del cliente, no una avería.
   */
  private async assertTableExists(tableId: string) {
    const exists = await this.tablesRepo.exists({ where: { id: tableId } });
    if (!exists) throw new NotFoundException(`Table ${tableId} not found`);
  }

  /**
   * Dos reservas para la misma mesa a la misma hora es una discusión en la puerta.
   *
   * Solo cuentan las vivas: una `cancelled` o un `no_show` no ocupan nada, y una `seated` ya se
   * está sentando, así que tampoco se le puede reservar encima —por eso el filtro es por lo que
   * **no** cuenta y no una lista de lo que sí.
   */
  private async assertFree(tableId: string, reservedAt: Date, exceptId?: string) {
    const slot = RESERVATION_SLOT_MINUTES * 60_000;
    const clash = await this.reservationsRepo.findOne({
      where: {
        tableId,
        status: Not(In(['cancelled', 'no_show'])),
        reservedAt: Between(new Date(reservedAt.getTime() - slot), new Date(reservedAt.getTime() + slot)),
        ...(exceptId ? { id: Not(exceptId) } : {}),
      },
    });
    if (clash) {
      throw new ConflictException(
        'Esa mesa ya tiene una reserva a esa hora. Elige otra mesa u otro horario.',
      );
    }
  }
}
