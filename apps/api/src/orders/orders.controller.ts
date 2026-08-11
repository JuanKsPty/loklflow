import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersMergeService } from './orders-merge.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddItemDto } from './dto/add-item.dto';
import { MergeOrdersDto } from './dto/merge-orders.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersMerge: OrdersMergeService,
  ) {}

  @Get()
  @RequirePermissions('orders:read')
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('orders:read')
  findOne(@Param('id', ParseUuidPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @RequirePermissions('orders:create')
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.ordersService.create(dto, user.sub);
  }

  @Post(':id/items')
  @RequirePermissions('orders:update')
  addItem(@Param('id', ParseUuidPipe) id: string, @Body() dto: AddItemDto) {
    return this.ordersService.addItem(id, dto);
  }

  /**
   * Fusiona varias cuentas en esta.
   *
   * La ruta cuelga de `orders` y no de `tables` aunque la funcionalidad se llame «fusión de
   * mesas»: lo que se fusiona es una **cuenta**, y nombrar la ruta por la entidad que de verdad se
   * mueve evita una ruta que miente sobre lo que hace.
   */
  @Post(':id/merge')
  @RequirePermissions('orders:update')
  merge(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: MergeOrdersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersMerge.merge(id, dto.sourceOrderIds, user.sub);
  }

  /** Devuelve esta cuenta —fusionada en otra— a su estado anterior, con sus líneas. */
  @Post(':id/unmerge')
  @RequirePermissions('orders:update')
  unmerge(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.ordersMerge.unmerge(id, user.sub);
  }

  @Patch(':id/status')
  @RequirePermissions('orders:update')
  updateStatus(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.updateStatus(id, dto, user.sub);
  }

  @Patch(':id/items/:itemId/status')
  @RequirePermissions('orders:update')
  updateItemStatus(
    @Param('id', ParseUuidPipe) id: string,
    @Param('itemId', ParseUuidPipe) itemId: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.ordersService.updateItemStatus(id, itemId, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('orders:update')
  updateItem(
    @Param('id', ParseUuidPipe) id: string,
    @Param('itemId', ParseUuidPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.ordersService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('orders:update')
  removeItem(
    @Param('id', ParseUuidPipe) id: string,
    @Param('itemId', ParseUuidPipe) itemId: string,
  ) {
    return this.ordersService.removeItem(id, itemId);
  }
}
