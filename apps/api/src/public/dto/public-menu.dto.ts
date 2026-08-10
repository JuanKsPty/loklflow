import { ApiProperty } from '@nestjs/swagger';

/**
 * Las formas que salen por la puerta pública.
 *
 * Existen como clases —y no como el tipo de la entidad— porque **una entidad expuesta tal cual
 * filtra**. `Product` lleva `station` (dónde se prepara), `isActive` y las marcas de tiempo;
 * `RestaurantTable` lleva su propio `qrCode`, el estado y la capacidad; `Order` lleva `waiterId`,
 * `shiftId`, los pagos y el historial de estados. Nada de eso le importa a un cliente y todo eso
 * dice algo sobre cómo funciona el negocio por dentro.
 *
 * Construir la respuesta campo a campo tiene además la propiedad de que **añadir una columna a una
 * entidad no la publica**: para que salga hacia fuera hay que escribirla aquí a mano.
 */

export class PublicBusinessDto {
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) logoUrl!: string | null;
  @ApiProperty() currency!: string;
  @ApiProperty() taxRate!: number;
}

export class PublicTableDto {
  @ApiProperty() id!: string;
  @ApiProperty() number!: number;
  @ApiProperty({ nullable: true }) sectorName!: string | null;
  /**
   * Si la mesa está recibiendo pedidos ahora mismo.
   *
   * Se calcula en el servidor y viaja al cliente para que la pantalla pueda ponerse en modo
   * lectura **antes** de que alguien llene un carrito. Sin esto, la única forma de descubrirlo
   * sería el 409 al enviar, con el pedido ya hecho.
   */
  @ApiProperty() acceptsOrders!: boolean;
}

export class PublicModifierOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() priceAdjustment!: number;
  @ApiProperty() isDefault!: boolean;
}

export class PublicModifierDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty() allowMultiple!: boolean;
  @ApiProperty() minSelections!: number;
  @ApiProperty({ nullable: true }) maxSelections!: number | null;
  @ApiProperty({ type: [PublicModifierOptionDto] }) options!: PublicModifierOptionDto[];
}

export class PublicProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() price!: number;
  @ApiProperty({ nullable: true }) imageUrl!: string | null;
  @ApiProperty({ nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: [PublicModifierDto] }) modifiers!: PublicModifierDto[];
}

export class PublicCategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({ nullable: true }) imageUrl!: string | null;
  @ApiProperty() sortOrder!: number;
}

export class PublicMenuDto {
  @ApiProperty({ type: PublicBusinessDto }) business!: PublicBusinessDto;
  @ApiProperty({ type: PublicTableDto }) table!: PublicTableDto;
  @ApiProperty({ type: [PublicCategoryDto] }) categories!: PublicCategoryDto[];
  @ApiProperty({ type: [PublicProductDto] }) products!: PublicProductDto[];
  /**
   * La hora del servidor.
   *
   * El menú está filtrado por horario contra **esta** hora, no la del teléfono. Viaja para que la
   * pantalla pueda decir «el menú de la cena empieza a las 19:00» sin fiarse de un reloj que puede
   * estar en otro huso o simplemente mal.
   */
  @ApiProperty() serverTime!: string;
}

export class PublicOrderItemStatusDto {
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ type: [String] }) modifiers!: string[];
}

/**
 * El estado de un pedido, para el cliente que lo hizo.
 *
 * Deliberadamente **sin** `waiterId`, `shiftId`, `payments`, `discountAmount` ni `statusHistory`:
 * quién le atiende, en qué turno, y qué descuentos se aplicaron son asuntos del negocio.
 */
export class PublicOrderStatusDto {
  @ApiProperty() orderNumber!: number;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true }) tableNumber!: number | null;
  @ApiProperty({ type: [PublicOrderItemStatusDto] }) items!: PublicOrderItemStatusDto[];
  @ApiProperty() subtotal!: number;
  @ApiProperty() total!: number;
}

export class PublicOrderCreatedDto {
  @ApiProperty({ type: PublicOrderStatusDto }) order!: PublicOrderStatusDto;
  /** El pase con el que seguir el pedido. Ver `guest-token.ts`. */
  @ApiProperty() trackingToken!: string;
}
