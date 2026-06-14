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
import { CreateOrderDto } from './dto/create-order.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { OrderStatus } from './order-status.constants';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('orders:read')
  findAll(@Query('status') status?: OrderStatus, @Query('tableId') tableId?: string) {
    return this.ordersService.findAll({ status, tableId });
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
