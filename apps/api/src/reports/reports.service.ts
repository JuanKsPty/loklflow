import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PAYMENT_METHODS, type PaymentMethod } from '../payments/payment-method.constants';
import { DateRangeDto } from './dto/date-range.dto';
import { toUtcTimestamp } from './utc-timestamp';

/** Estados que cuentan como venta consumada. */
const SOLD_STATUSES = ['closed'];
/** Estados que cuentan como cuenta viva. */
const OPEN_STATUSES = ['pending', 'preparing', 'ready', 'delivered'];

export interface SalesSummary {
  from: string;
  to: string;
  /** Ventas cobradas: suma de pagos registrados en el rango. */
  totalSales: number;
  paymentsCount: number;
  byMethod: Record<PaymentMethod, number>;
  /** Órdenes cerradas en el rango. */
  ordersClosed: number;
  /** Ticket promedio de las órdenes cerradas. */
  averageTicket: number;
  totalDiscounts: number;
  totalTips: number;
  openOrders: number;
  openOrdersValue: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface PrepTimeMetric {
  /** Minutos medios entre la creación de la orden y el paso a "ready". */
  averageMinutes: number | null;
  /** Minutos medios entre "preparing" y "ready", el tiempo puro de cocina. */
  averageKitchenMinutes: number | null;
  sampleSize: number;
}

export interface SalesByDay {
  day: string;
  total: number;
  orders: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemsRepo: Repository<OrderItem>,
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(OrderStatusHistory)
    private readonly historyRepo: Repository<OrderStatusHistory>,
  ) {}

  /**
   * Resumen de ventas del rango. Todo se agrega en SQL (`SUM`/`COUNT`/`GROUP BY`) en
   * lugar de traer filas y sumar en JS, para que no se degrade al crecer el histórico.
   */
  async salesSummary(range: DateRangeDto): Promise<SalesSummary> {
    const { from, to } = this.resolveRange(range);

    const paymentsRow = await this.paymentsRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.processedAt BETWEEN :from AND :to', { from, to })
      .getRawOne<{ total: string; count: string }>();

    const byMethodRows = await this.paymentsRepo
      .createQueryBuilder('p')
      .select('p.method', 'method')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.processedAt BETWEEN :from AND :to', { from, to })
      .groupBy('p.method')
      .getRawMany<{ method: PaymentMethod; total: string }>();

    // Todos los métodos presentes aunque valgan 0, igual que en el arqueo de turno:
    // así el frontend puede iterar sin defensas.
    const byMethod = PAYMENT_METHODS.reduce(
      (acc, m) => ({ ...acc, [m]: 0 }),
      {} as Record<PaymentMethod, number>,
    );
    for (const row of byMethodRows) {
      byMethod[row.method] = this.money(row.total);
    }

    const closedRow = await this.ordersRepo
      .createQueryBuilder('o')
      .select('COUNT(o.id)', 'count')
      .addSelect('COALESCE(SUM(o.total), 0)', 'total')
      .addSelect('COALESCE(SUM(o.discountAmount), 0)', 'discounts')
      .addSelect('COALESCE(SUM(o.tipAmount), 0)', 'tips')
      .where('o.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('o.status IN (:...statuses)', { statuses: SOLD_STATUSES })
      .getRawOne<{ count: string; total: string; discounts: string; tips: string }>();

    const openRow = await this.ordersRepo
      .createQueryBuilder('o')
      .select('COUNT(o.id)', 'count')
      .addSelect('COALESCE(SUM(o.total), 0)', 'total')
      .where('o.status IN (:...statuses)', { statuses: OPEN_STATUSES })
      .getRawOne<{ count: string; total: string }>();

    const ordersClosed = Number(closedRow?.count ?? 0);
    const closedTotal = this.money(closedRow?.total);

    return {
      from,
      to,
      totalSales: this.money(paymentsRow?.total),
      paymentsCount: Number(paymentsRow?.count ?? 0),
      byMethod,
      ordersClosed,
      averageTicket: ordersClosed > 0 ? this.money(closedTotal / ordersClosed) : 0,
      totalDiscounts: this.money(closedRow?.discounts),
      totalTips: this.money(closedRow?.tips),
      openOrders: Number(openRow?.count ?? 0),
      openOrdersValue: this.money(openRow?.total),
    };
  }

  /** Productos más vendidos por cantidad, sobre líneas no canceladas. */
  async topProducts(range: DateRangeDto, limit = 5): Promise<TopProduct[]> {
    const { from, to } = this.resolveRange(range);

    const rows = await this.itemsRepo
      .createQueryBuilder('i')
      .innerJoin('i.order', 'o')
      .innerJoin('i.product', 'prod')
      .select('prod.id', 'productId')
      .addSelect('prod.name', 'name')
      .addSelect('COALESCE(SUM(i.quantity), 0)', 'quantity')
      .addSelect('COALESCE(SUM(i.subtotal), 0)', 'revenue')
      .where('o.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere("i.status != 'cancelled'")
      .groupBy('prod.id')
      .addGroupBy('prod.name')
      .orderBy('SUM(i.quantity)', 'DESC')
      .limit(Math.min(Math.max(1, limit), 50))
      .getRawMany<{ productId: string; name: string; quantity: string; revenue: string }>();

    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantity: Number(r.quantity),
      revenue: this.money(r.revenue),
    }));
  }

  /**
   * Tiempos medios de preparación, derivados de `order_status_history`.
   * Es la primera lectura de esa tabla: se escribía desde el principio y nadie la usaba.
   */
  async prepTimes(range: DateRangeDto): Promise<PrepTimeMetric> {
    const { from, to } = this.resolveRange(range);

    // Primera marca de 'ready' por orden, contra la creación de la orden y contra la
    // primera marca de 'preparing'.
    const row = await this.historyRepo
      .createQueryBuilder('h')
      .select(
        'AVG(EXTRACT(EPOCH FROM (h.changedAt - o.createdAt)) / 60)',
        'totalMinutes',
      )
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (h.changedAt - prep.changed_at)) / 60)',
        'kitchenMinutes',
      )
      .addSelect('COUNT(DISTINCT h.orderId)', 'sample')
      .innerJoin('orders', 'o', 'o.id = h.order_id')
      .leftJoin(
        (qb) =>
          qb
            .select('osh.order_id', 'order_id')
            .addSelect('MIN(osh.changed_at)', 'changed_at')
            .from('order_status_history', 'osh')
            .where("osh.to_status = 'preparing'")
            .groupBy('osh.order_id'),
        'prep',
        'prep.order_id = h.order_id',
      )
      .where("h.toStatus = 'ready'")
      .andWhere('h.changedAt BETWEEN :from AND :to', { from, to })
      .getRawOne<{
        totalMinutes: string | null;
        kitchenMinutes: string | null;
        sample: string;
      }>();

    const round = (v: string | null | undefined) =>
      v === null || v === undefined ? null : Number(Number(v).toFixed(1));

    return {
      averageMinutes: round(row?.totalMinutes),
      averageKitchenMinutes: round(row?.kitchenMinutes),
      sampleSize: Number(row?.sample ?? 0),
    };
  }

  /** Ventas por día del rango, para la serie del dashboard. */
  async salesByDay(range: DateRangeDto): Promise<SalesByDay[]> {
    const { from, to } = this.resolveRange(range);

    const rows = await this.paymentsRepo
      .createQueryBuilder('p')
      .select("TO_CHAR(DATE_TRUNC('day', p.processedAt), 'YYYY-MM-DD')", 'day')
      .addSelect('COALESCE(SUM(p.amount), 0)', 'total')
      .addSelect('COUNT(DISTINCT p.orderId)', 'orders')
      .where('p.processedAt BETWEEN :from AND :to', { from, to })
      .groupBy("DATE_TRUNC('day', p.processedAt)")
      .orderBy("DATE_TRUNC('day', p.processedAt)", 'ASC')
      .getRawMany<{ day: string; total: string; orders: string }>();

    return rows.map((r) => ({
      day: r.day,
      total: this.money(r.total),
      orders: Number(r.orders),
    }));
  }

  /** Filas planas para exportar a CSV: una por pago, con el contexto de su orden. */
  async salesRows(range: DateRangeDto) {
    const { from, to } = this.resolveRange(range);

    return this.paymentsRepo
      .createQueryBuilder('p')
      .innerJoin('orders', 'o', 'o.id = p.order_id')
      .select('p.processedAt', 'processedAt')
      .addSelect('o.order_number', 'orderNumber')
      .addSelect('p.method', 'method')
      .addSelect('p.amount', 'amount')
      .addSelect('p.reference', 'reference')
      .addSelect('o.subtotal', 'subtotal')
      .addSelect('o.discount_amount', 'discountAmount')
      .addSelect('o.tip_amount', 'tipAmount')
      .addSelect('o.total', 'orderTotal')
      .addSelect('o.status', 'orderStatus')
      .addSelect('p.shift_id', 'shiftId')
      .where('p.processedAt BETWEEN :from AND :to', { from, to })
      .orderBy('p.processedAt', 'ASC')
      .getRawMany<Record<string, unknown>>();
  }

  // ---------------------------------------------------------------- privados

  /**
   * Sin rango explícito, el día de hoy completo en la hora local del servidor.
   *
   * Los límites se devuelven como **string UTC sin zona** (`YYYY-MM-DD HH:mm:ss`), no
   * como `Date`. Es deliberado: las columnas de fecha del esquema son
   * `timestamp without time zone` y guardan UTC, pero node-postgres serializa un `Date`
   * usando la zona local del proceso. Al comparar, Postgres se queda con la parte
   * literal y el rango salía desplazado tantas horas como el offset del servidor
   * (con el proceso en GMT-5, cinco horas: las filas de la última madrugada
   * desaparecían de los reportes).
   */
  private resolveRange(range: DateRangeDto): { from: string; to: string } {
    const now = new Date();
    const from = range.from
      ? new Date(range.from)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const to = range.to
      ? new Date(range.to)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: toUtcTimestamp(from), to: toUtcTimestamp(to) };
  }

  /** Los agregados de Postgres llegan como string; a número con 2 decimales. */
  private money(value: string | number | null | undefined): number {
    return Number((Number(value ?? 0) || 0).toFixed(2));
  }
}
