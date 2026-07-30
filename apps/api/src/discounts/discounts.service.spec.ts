import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { DiscountsService } from './discounts.service';
import type { Discount } from './entities/discount.entity';
import type { Order } from '../orders/entities/order.entity';
import type { OrdersService } from '../orders/orders.service';
import type { RolesService } from '../roles/roles.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AuditService } from '../audit/audit.service';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

const cajero: JwtPayload = {
  sub: 'u-cajero',
  name: 'Carla Cajera',
  email: 'carla@loklflow.com',
  roleId: 'r-cajero',
  roleName: 'Cajero',
  permissions: ['pos:create', 'pos:read'],
  loginMethod: 'pin',
};

const gerente: JwtPayload = {
  sub: 'u-gerente',
  name: 'Gabriel Gerente',
  email: 'gabriel@loklflow.com',
  roleId: 'r-gerente',
  roleName: 'Gerente',
  permissions: ['pos:approve_discount'],
  loginMethod: 'email',
};

/** Orden mínima con lo que lee el service. */
function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    orderNumber: 42,
    status: 'delivered',
    subtotal: 100,
    discountAmount: 0,
    tipAmount: 0,
    total: 100,
    payments: [],
    ...over,
  } as unknown as Order;
}

function setup(opts: { threshold?: number; order?: Order; saved?: Partial<Discount> } = {}) {
  const order = opts.order ?? makeOrder();
  const rows: Discount[] = [];

  const repo = {
    create: jest.fn((x: Partial<Discount>) => ({ id: 'd-1', ...x }) as Discount),
    save: jest.fn((x: Discount) => {
      rows.push(x);
      return Promise.resolve(x);
    }),
    findOne: jest.fn(() =>
      Promise.resolve(
        opts.saved
          ? ({ id: 'd-1', orderId: order.id, status: 'pending', ...opts.saved } as Discount)
          : rows[0] ?? null,
      ),
    ),
    findAndCount: jest.fn(() => Promise.resolve([[], 0])),
    count: jest.fn(() => Promise.resolve(0)),
  } as unknown as Repository<Discount>;

  const orders = {
    findOne: jest.fn(() => Promise.resolve(order)),
    setDiscount: jest.fn(() => Promise.resolve(order)),
  } as unknown as OrdersService;

  const roles = {
    findOne: jest.fn(() =>
      // Se devuelve string a propósito: así llegaba antes de añadir el transformer,
      // y el service debe seguir siendo inmune.
      Promise.resolve({ maxDiscountPercentage: String(opts.threshold ?? 10) }),
    ),
  } as unknown as RolesService;

  const notifications = {
    notifyRole: jest.fn(() => Promise.resolve()),
    notifyUser: jest.fn(() => Promise.resolve()),
  } as unknown as NotificationsService;

  const audit = { createLog: jest.fn(() => Promise.resolve()) } as unknown as AuditService;

  const service = new DiscountsService(repo, orders, roles, notifications, audit);
  return { service, repo, orders, roles, notifications, audit, rows };
}

const dto = (over: Partial<{ type: 'percentage' | 'fixed'; value: number; reason: string }> = {}) => ({
  type: 'percentage' as const,
  value: 5,
  reason: 'Cliente frecuente',
  ...over,
});

describe('DiscountsService.request — umbral del rol', () => {
  it('aplica directo cuando el porcentaje cabe en el umbral', async () => {
    const { service, orders, rows } = setup({ threshold: 10 });
    await service.request('o-1', dto({ value: 5 }), cajero);

    expect(rows[0].status).toBe('approved');
    expect(rows[0].approvedBy).toBe(cajero.sub);
    expect(orders.setDiscount).toHaveBeenCalledWith('o-1', 5, cajero.sub);
  });

  it('deja pendiente cuando excede el umbral y NO toca el total', async () => {
    const { service, orders, rows } = setup({ threshold: 10 });
    await service.request('o-1', dto({ value: 30 }), cajero);

    expect(rows[0].status).toBe('pending');
    expect(rows[0].approvedBy).toBeNull();
    expect(orders.setDiscount).not.toHaveBeenCalled();
  });

  it('el porcentaje exactamente igual al umbral se autoaprueba', async () => {
    const { service, rows } = setup({ threshold: 10 });
    await service.request('o-1', dto({ value: 10 }), cajero);
    expect(rows[0].status).toBe('approved');
  });

  it('un umbral de 0 manda todo a aprobación', async () => {
    const { service, rows } = setup({ threshold: 0 });
    await service.request('o-1', dto({ value: 1 }), cajero);
    expect(rows[0].status).toBe('pending');
  });

  it('un umbral de 100 autoaprueba incluso el descuento total', async () => {
    const { service, rows } = setup({ threshold: 100 });
    await service.request('o-1', dto({ value: 100 }), cajero);
    expect(rows[0].status).toBe('approved');
  });

  it('no se rompe si el umbral llega como string (columna decimal)', async () => {
    const { service, rows } = setup({ threshold: 50 });
    await service.request('o-1', dto({ value: 25 }), cajero);
    expect(rows[0].status).toBe('approved');
  });

  it('convierte un importe fijo a porcentaje para compararlo con el umbral', async () => {
    // 20 sobre un subtotal de 100 es 20%, por encima del umbral de 10.
    const { service, rows } = setup({ threshold: 10 });
    await service.request('o-1', dto({ type: 'fixed', value: 20 }), cajero);
    expect(rows[0].percentage).toBe(20);
    expect(rows[0].status).toBe('pending');
  });

  it('guarda el importe resuelto, no solo el porcentaje', async () => {
    const { service, rows } = setup({ threshold: 100, order: makeOrder({ subtotal: 250 }) });
    await service.request('o-1', dto({ value: 20 }), cajero);
    expect(rows[0].amount).toBe(50);
    expect(rows[0].value).toBe(20);
  });
});

describe('DiscountsService.request — guardas', () => {
  it('rechaza un porcentaje mayor que 100', async () => {
    const { service } = setup();
    await expect(service.request('o-1', dto({ value: 120 }), cajero)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza un importe fijo mayor que el subtotal', async () => {
    const { service } = setup({ order: makeOrder({ subtotal: 50 }) });
    await expect(
      service.request('o-1', dto({ type: 'fixed', value: 75 }), cajero),
    ).rejects.toThrow(/excede el subtotal/);
  });

  it('rechaza sobre una cuenta cerrada', async () => {
    const { service } = setup({ order: makeOrder({ status: 'closed' }) });
    await expect(service.request('o-1', dto(), cajero)).rejects.toThrow(/cerrada o cancelada/);
  });

  it('rechaza sobre una cuenta cancelada', async () => {
    const { service } = setup({ order: makeOrder({ status: 'cancelled' }) });
    await expect(service.request('o-1', dto(), cajero)).rejects.toThrow(/cerrada o cancelada/);
  });

  it('rechaza si el descuento dejaría el total por debajo de lo ya cobrado', async () => {
    // Cuenta de 100 con 50 cobrados; un descuento de 60 dejaría el total en 40.
    const order = makeOrder({ payments: [{ amount: 50 }] as Order['payments'] });
    const { service, orders } = setup({ threshold: 100, order });

    await expect(
      service.request('o-1', dto({ type: 'fixed', value: 60 }), cajero),
    ).rejects.toThrow(/por debajo de lo ya cobrado/);
    expect(orders.setDiscount).not.toHaveBeenCalled();
  });

  it('permite el descuento que deja la cuenta exactamente saldada', async () => {
    // 100 de total, 50 cobrados, descuento de 50 → total 50 = pagado.
    const order = makeOrder({ payments: [{ amount: 50 }] as Order['payments'] });
    const { service, orders } = setup({ threshold: 100, order });

    await service.request('o-1', dto({ type: 'fixed', value: 50 }), cajero);
    expect(orders.setDiscount).toHaveBeenCalledWith('o-1', 50, cajero.sub);
  });

  it('tiene en cuenta la propina al proyectar el total', async () => {
    // subtotal 100, propina 20, pagado 60. Descuento de 60 → total = 60. Justo saldado.
    const order = makeOrder({
      tipAmount: 20,
      total: 120,
      payments: [{ amount: 60 }] as Order['payments'],
    });
    const { service, orders } = setup({ threshold: 100, order });

    await service.request('o-1', dto({ type: 'fixed', value: 60 }), cajero);
    expect(orders.setDiscount).toHaveBeenCalled();
  });
});

describe('DiscountsService.request — notificación', () => {
  it('avisa a Gerente y Administrador cuando queda pendiente', async () => {
    const { service, notifications } = setup({ threshold: 0 });
    await service.request('o-1', dto({ value: 5 }), cajero);

    const calls = (notifications.notifyRole as jest.Mock).mock.calls;
    expect(calls.map((c) => c[0])).toEqual(['Gerente', 'Administrador']);
    expect(calls[0][1]).toMatchObject({
      type: 'discount_pending',
      resourceType: 'discount',
      resourceId: 'd-1',
    });
  });

  it('no avisa a nadie cuando se autoaprueba', async () => {
    const { service, notifications } = setup({ threshold: 100 });
    await service.request('o-1', dto({ value: 5 }), cajero);
    expect(notifications.notifyRole).not.toHaveBeenCalled();
  });

  it('el cuerpo del aviso no excede el límite de la columna', async () => {
    const { service, notifications } = setup({ threshold: 0 });
    await service.request('o-1', dto({ value: 5, reason: 'x'.repeat(255) }), cajero);

    const body = (notifications.notifyRole as jest.Mock).mock.calls[0][1].body as string;
    expect(body.length).toBeLessThanOrEqual(500);
  });
});

describe('DiscountsService.approve / reject', () => {
  it('aprueba, aplica el importe y avisa al solicitante', async () => {
    const { service, orders, notifications, rows } = setup({
      saved: { amount: 30, percentage: 30, requestedBy: cajero.sub },
    });

    await service.approve('d-1', gerente);

    expect(rows[0].status).toBe('approved');
    expect(rows[0].approvedBy).toBe(gerente.sub);
    expect(rows[0].resolvedAt).toBeInstanceOf(Date);
    expect(orders.setDiscount).toHaveBeenCalledWith('o-1', 30, gerente.sub);
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      cajero.sub,
      expect.objectContaining({ title: 'Descuento aprobado' }),
    );
  });

  it('rechaza y NO aplica nada', async () => {
    const { service, orders, notifications, rows } = setup({
      saved: { amount: 30, requestedBy: cajero.sub },
    });

    await service.reject('d-1', { reason: 'Sin justificación' }, gerente);

    expect(rows[0].status).toBe('rejected');
    expect(rows[0].rejectionReason).toBe('Sin justificación');
    expect(orders.setDiscount).not.toHaveBeenCalled();
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      cajero.sub,
      expect.objectContaining({ title: 'Descuento rechazado' }),
    );
  });

  it('no se puede aprobar dos veces', async () => {
    const { service } = setup({ saved: { status: 'approved', amount: 10 } });
    await expect(service.approve('d-1', gerente)).rejects.toThrow(/ya fue aprobado/);
  });

  it('no se puede aprobar uno rechazado', async () => {
    const { service } = setup({ saved: { status: 'rejected', amount: 10 } });
    await expect(service.approve('d-1', gerente)).rejects.toThrow(/ya fue rechazado/);
  });

  it('revalida contra el estado actual: si la cuenta cambió, no aplica', async () => {
    // Se pidió 60 sobre 100, pero mientras tanto se cobraron 80.
    const order = makeOrder({ payments: [{ amount: 80 }] as Order['payments'] });
    const { service, orders } = setup({ order, saved: { amount: 60, requestedBy: cajero.sub } });

    await expect(service.approve('d-1', gerente)).rejects.toThrow(/ya no es aplicable/);
    expect(orders.setDiscount).not.toHaveBeenCalled();
  });

  it('revalida el subtotal: si bajó por cancelar líneas, no aplica', async () => {
    const order = makeOrder({ subtotal: 20, total: 20 });
    const { service } = setup({ order, saved: { amount: 60, requestedBy: cajero.sub } });
    await expect(service.approve('d-1', gerente)).rejects.toThrow(/excede el subtotal/);
  });

  it('404 si el descuento no existe', async () => {
    const { service, repo } = setup();
    (repo.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.approve('inexistente', gerente)).rejects.toThrow(NotFoundException);
  });
});

describe('DiscountsService.findAll', () => {
  it('ordena los pendientes de más antiguo a más nuevo: es una cola de trabajo', async () => {
    const { service, repo } = setup();
    await service.findAll({ status: 'pending' });
    const args = (repo.findAndCount as jest.Mock).mock.calls[0][0];
    expect(args.order).toEqual({ createdAt: 'ASC' });
    expect(args.where).toEqual({ status: 'pending' });
  });

  it('el historial va de más nuevo a más antiguo', async () => {
    const { service, repo } = setup();
    await service.findAll({ orderId: 'o-1' });
    expect((repo.findAndCount as jest.Mock).mock.calls[0][0].order).toEqual({
      createdAt: 'DESC',
    });
  });

  it('recorta el limit al tope', async () => {
    const { service, repo } = setup();
    await service.findAll({ limit: 99999 });
    expect((repo.findAndCount as jest.Mock).mock.calls[0][0].take).toBe(100);
  });
});
