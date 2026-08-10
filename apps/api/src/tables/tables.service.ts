import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import type { TableStatus } from './status.constants';
import { RestaurantTable } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { LayoutPositionDto } from './dto/update-layout.dto';
import { BulkCreateTableDto } from './dto/bulk-create-table.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(RestaurantTable)
    private tablesRepo: Repository<RestaurantTable>,
    private readonly realtime: RealtimeGateway,
  ) {}

  findAll() {
    return this.tablesRepo.find({
      relations: { sector: true },
      order: { number: 'ASC' },
    });
  }

  async findOne(id: string) {
    const table = await this.tablesRepo.findOne({
      where: { id },
      relations: { sector: true },
    });
    if (!table) throw new NotFoundException(`Table ${id} not found`);
    return table;
  }

  async nextNumber(): Promise<number> {
    const row = await this.tablesRepo
      .createQueryBuilder('t')
      .select('MAX(t.number)', 'max')
      .getRawOne<{ max: number | null }>();
    return (row?.max ?? 0) + 1;
  }

  async create(dto: CreateTableDto) {
    const number = dto.number ?? (await this.nextNumber());
    const table = this.tablesRepo.create({
      number,
      sectorId: dto.sectorId,
      capacity: dto.capacity,
      status: dto.status ?? 'available',
      shape: dto.shape ?? 'square',
      positionX: dto.positionX ?? null,
      positionY: dto.positionY ?? null,
      isActive: dto.isActive ?? true,
      qrCode: randomUUID(),
    });
    const saved = await this.saveUnique(table);
    return this.findOne(saved.id);
  }

  async createMany(dto: BulkCreateTableDto) {
    const start = await this.nextNumber();
    const capacity = dto.capacity ?? 4;
    const shape = dto.shape ?? 'square';
    const tables = Array.from({ length: dto.count }, (_, i) =>
      this.tablesRepo.create({
        number: start + i,
        sectorId: dto.sectorId,
        capacity,
        shape,
        status: 'available',
        positionX: null,
        positionY: null,
        qrCode: randomUUID(),
      }),
    );
    try {
      await this.tablesRepo.save(tables);
    } catch (err) {
      if (err instanceof QueryFailedError && /unique|duplicate/i.test(err.message)) {
        throw new BadRequestException('Conflicto de números al crear las mesas, intenta de nuevo');
      }
      throw err;
    }
    return this.findAll();
  }

  async update(id: string, dto: UpdateTableDto) {
    const table = await this.findOne(id);
    Object.assign(table, dto);
    const saved = await this.saveUnique(table);
    const result = await this.findOne(saved.id);
    this.realtime.emitTable({ type: 'update', tableId: result.id, status: result.status });
    return result;
  }

  /**
   * `occurredAt` es la hora a la que el cambio ocurrió en el salón, no aquella en que la
   * petición llega. La manda la cola sin conexión al reenviar.
   *
   * El estado de una mesa es el **único** dato encolable que dos dispositivos pueden pisarse:
   * el mesero la marca libre sin red mientras el cajero la marca ocupada desde caja. El orden
   * de llegada no dice nada sobre el orden de los hechos, así que una operación cuyo hecho es
   * anterior al último cambio de la mesa ya nació obsoleta y se ignora.
   *
   * Se ignora **con 200 y sin emitir evento**, no con 400: la cola trata cualquier 4xx como
   * fallo definitivo, y nadie debería encontrarse una entrada en la bandeja de fallos por el
   * color de una mesa. Para quien llamó, la operación se aplicó; el estado que devuelve es el
   * bueno, que es lo que la pantalla necesita saber.
   *
   * La comparación va contra `status_changed_at` y **nunca** contra `updated_at`: esta última
   * es `TIMESTAMP` sin zona horaria, el driver la interpreta en la zona del proceso, y con
   * `TZ=America/Mexico_City` se lee seis horas en el futuro — con lo que el guard rechazaría
   * absolutamente todo y el test que lo comprueba pasaría por el motivo equivocado.
   */
  async updateStatus(id: string, status: TableStatus, occurredAt?: Date | null) {
    const table = await this.findOne(id);
    if (occurredAt && occurredAt.getTime() < table.statusChangedAt.getTime()) return table;
    table.status = status;
    table.statusChangedAt = new Date();
    await this.tablesRepo.save(table);
    const result = await this.findOne(id);
    this.realtime.emitTable({ type: 'status', tableId: result.id, status: result.status });
    return result;
  }

  /**
   * Genera un token de QR nuevo para la mesa, invalidando el anterior.
   *
   * Es lo que hace útil el QR del cliente: sin rotación, un token filtrado —una foto de la hoja
   * subida a redes, una mesa que se cambia de sitio— vale para siempre y no hay forma de
   * revocarlo. Al rotar, el token viejo deja de resolver y el pedido desde esa hoja da 404.
   *
   * Se cambia el valor y no se «desactiva» nada: `qr_code` es único y no nullable, así que el
   * token anterior desaparece del sistema en la misma escritura.
   */
  async rotateQrCode(id: string) {
    const table = await this.findOne(id);
    table.qrCode = randomUUID();
    await this.tablesRepo.save(table);
    const result = await this.findOne(id);
    this.realtime.emitTable({ type: 'update', tableId: result.id, status: result.status });
    return result;
  }

  async remove(id: string) {
    const table = await this.findOne(id);
    await this.tablesRepo.remove(table);
  }

  async saveLayout(positions: LayoutPositionDto[]) {
    const ids = positions.map((p) => p.id);
    const tables = await this.tablesRepo.find({ where: { id: In(ids) } });
    const byId = new Map(tables.map((t) => [t.id, t]));

    for (const pos of positions) {
      const table = byId.get(pos.id);
      if (!table) continue;
      table.positionX = pos.positionX;
      table.positionY = pos.positionY;
      if (pos.shape) table.shape = pos.shape;
    }

    await this.tablesRepo.save([...byId.values()]);
    this.realtime.emitTable({ type: 'layout' });
    return this.findAll();
  }

  private async saveUnique(table: RestaurantTable) {
    try {
      return await this.tablesRepo.save(table);
    } catch (err) {
      if (err instanceof QueryFailedError && /unique|duplicate/i.test(err.message)) {
        throw new BadRequestException(`Ya existe una mesa con el número ${table.number}`);
      }
      throw err;
    }
  }
}
