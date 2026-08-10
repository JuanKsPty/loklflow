import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private readonly suppliersRepo: Repository<Supplier>,
  ) {}

  findAll() {
    return this.suppliersRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const supplier = await this.suppliersRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException(`Proveedor ${id} no encontrado`);
    return supplier;
  }

  create(dto: CreateSupplierDto) {
    return this.suppliersRepo.save(this.suppliersRepo.create(dto));
  }

  async update(id: string, dto: UpdateSupplierDto) {
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
