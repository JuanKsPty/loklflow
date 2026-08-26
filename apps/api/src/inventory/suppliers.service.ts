import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { matchesText } from '../common/search';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private readonly suppliersRepo: Repository<Supplier>,
  ) {}

  findAll(q?: string) {
    return this.suppliersRepo.find({
      where: q ? { name: matchesText(q) } : {},
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const supplier = await this.suppliersRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException(`Proveedor ${id} no encontrado`);
    return supplier;
  }

  create(dto: CreateSupplierDto) {
    return this.suppliersRepo.save(this.suppliersRepo.create(dto));
  }


  /**
   * `isActive: false` **no** se acepta por aquí, y la asimetría es deliberada.
   *
   * Desactivar es una baja lógica: tiene su propio endpoint, con permiso `inventory:delete`, y su
   * comentario explicando por qué no se borra. Permitirlo también en el PATCH —que va con
   * `inventory:update`— hacía que ese permiso no sirviera para nada: cualquiera con permiso de
   * edición podía dar de baja, que es justo lo que el controlador guarda aparte. Los formularios lo
   * hacían así con un interruptor, y por eso `inventory:delete` no lo ejercía nadie.
   *
   * Reactivar **sí** se permite por PATCH: no es destructivo, y exigir un endpoint aparte para
   * volver a poner algo en circulación sería ceremonia sin motivo.
   */
  async update(id: string, dto: UpdateSupplierDto) {
    if (dto.isActive === false) {
      throw new BadRequestException(
        'Para dar de baja un proveedor usa la baja lógica, no la edición.',
      );
    }
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
    return this.suppliersRepo.save(supplier);
  }

  /**
   * Baja lógica, no borrado.
   *
   * Un proveedor está referenciado por las entradas de mercancía que trajo, y borrarlo
   * pondría a `null` el proveedor de movimientos históricos (la clave ajena es `SET NULL`):
   * el historial dejaría de poder decir a quién se le compró. Desactivar lo saca de los
   * desplegables y conserva la contabilidad.
   */
  async deactivate(id: string) {
    const supplier = await this.findOne(id);
    supplier.isActive = false;
    return this.suppliersRepo.save(supplier);
  }
}
