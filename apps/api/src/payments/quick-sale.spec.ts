import { BadRequestException } from '@nestjs/common';
import { QuickSaleService } from './quick-sale.service';
import type { QuickSaleDto } from './dto/quick-sale.dto';

/**
 * Los caminos de error de la venta de mostrador, con dobles.
 *
 * Van aquí y no en la suite de integración porque lo que hay que provocar —que el cobro falle
 * **después** de que la orden exista, que la cuenta llegue cancelada, que el cierre no se haya
 * producido— son estados que contra una base real solo se alcanzan con carreras. Lo que se afirma
 * es el orden de las operaciones y qué se deja escrito, que es justo lo que decide si una venta a
 * medias se puede retomar o se pierde.
 */
describe('QuickSaleService', () => {
  const DTO: QuickSaleDto = {
    id: '11111111-1111-4111-8111-111111111111',
    items: [{ productId: '22222222-2222-4222-8222-222222222222', quantity: 2 }],
    payment: { method: 'cash' },
  };

  const orden = (over: Record<string, unknown> = {}) => ({
    id: DTO.id,
    orderNumber: 42,
    status: 'pending',
    total: 100,
    ...over,
  });

  function build(over: {
    shift?: unknown;
    created?: Record<string, unknown>;
    addPayment?: jest.Mock;
    summary?: jest.Mock;
  } = {}) {
    const orders = {
      create: jest.fn().mockResolvedValue(orden(over.created)),
      findOne: jest.fn().mockResolvedValue(orden({ status: 'closed' })),
      closeFromPayment: jest.fn().mockResolvedValue(undefined),
    };
    const payments = {
      addPayment: over.addPayment ?? jest.fn().mockResolvedValue(undefined),
      summary: over.summary ?? jest.fn().mockResolvedValue({ total: 100, paid: 100, remaining: 0 }),
    };
    const shifts = {
      currentForUser: jest
        .fn()
        .mockResolvedValue(over.shift === undefined ? { id: 'turno-1' } : over.shift),
    };

    const service = new QuickSaleService(
      orders as never,
      payments as never,
      shifts as never,
    );
    // El logger escribe en la salida real; aquí solo estorbaría.
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    return { service, orders, payments, shifts };
  }

  it('sin turno de caja abierto no llega a crear la orden', async () => {
    // Es el caso que justifica comprobar el turno antes de escribir nada: si se dejara solo en
    // `addPayment`, el fallo más probable del endpoint dejaría una cuenta de mostrador huérfana.
    const { service, orders } = build({ shift: null });

    await expect(service.execute(DTO, 'u1')).rejects.toThrow(BadRequestException);
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('cobra el total que calculó el servidor, no uno que venga en el cuerpo', async () => {
    const { service, payments } = build();

    await service.execute(DTO, 'u1');

    expect(payments.addPayment).toHaveBeenCalledWith(
      DTO.id,
      expect.objectContaining({ amount: 100, method: 'cash' }),
      'u1',
    );
  });

  it('deriva la clave de idempotencia del pago del id de la venta cuando no viene', async () => {
    const { service, payments } = build();

    await service.execute(DTO, 'u1');

    expect(payments.addPayment).toHaveBeenCalledWith(
      DTO.id,
      expect.objectContaining({ clientRequestId: `quick-sale:${DTO.id}` }),
      'u1',
    );
  });

  it('respeta la clave que traiga el dispositivo', async () => {
    const { service, payments } = build();

    await service.execute({ ...DTO, clientRequestId: 'mia' }, 'u1');

    expect(payments.addPayment).toHaveBeenCalledWith(
      DTO.id,
      expect.objectContaining({ clientRequestId: 'mia' }),
      'u1',
    );
  });

  it('una venta ya cerrada se devuelve tal cual, sin volver a cobrar', async () => {
    // Un reenvío con el mismo id pero **otra** clave de pago llegaría a `addPayment` sobre una
    // cuenta cerrada y el operario vería un error sobre una venta que sí se hizo.
    const { service, payments } = build({ created: { status: 'closed' } });

    await service.execute(DTO, 'u1');

    expect(payments.addPayment).not.toHaveBeenCalled();
  });

  it('una venta cancelada se rechaza en lugar de intentar cobrarla', async () => {
    const { service, payments } = build({ created: { status: 'cancelled' } });

    await expect(service.execute(DTO, 'u1')).rejects.toThrow(/canceló/);
    expect(payments.addPayment).not.toHaveBeenCalled();
  });

  it('un total de cero se rechaza con un motivo, no con un error de validación', async () => {
    // `CreatePaymentDto.amount` es `@Min(0.01)` y `ALLOWED_TRANSITIONS` no deja cerrar de un salto:
    // sin esta guarda saldría un 400 sin explicación.
    const { service, payments } = build({ created: { total: 0 } });

    await expect(service.execute(DTO, 'u1')).rejects.toThrow(/importe/);
    expect(payments.addPayment).not.toHaveBeenCalled();
  });

  describe('si el cobro falla', () => {
    it('la orden no se cancela: es lo que permite reintentar', async () => {
      const { service, orders } = build({
        addPayment: jest.fn().mockRejectedValue(new BadRequestException('Se cayó la red')),
      });

      await expect(service.execute(DTO, 'u1')).rejects.toThrow(BadRequestException);
      expect(orders.closeFromPayment).not.toHaveBeenCalled();
    });

    it('y el mensaje dice el número de cuenta que quedó abierta', async () => {
      // El filtro global descarta cualquier campo del cuerpo de error que no sea `message`, así
      // que si el número no va dentro del texto, la pantalla no puede decir qué venta quedó a
      // medias.
      const { service } = build({
        addPayment: jest.fn().mockRejectedValue(new BadRequestException('No hay turno')),
      });

      await expect(service.execute(DTO, 'u1')).rejects.toThrow(/#42/);
    });

    it('conserva el motivo original del fallo', async () => {
      const { service } = build({
        addPayment: jest.fn().mockRejectedValue(new BadRequestException('Se cayó la red')),
      });

      await expect(service.execute(DTO, 'u1')).rejects.toThrow(/Se cayó la red/);
    });

    it('un error que no es de negocio se propaga como está, sin disfrazarse de 400', async () => {
      const roto = new Error('la base no responde');
      const { service } = build({ addPayment: jest.fn().mockRejectedValue(roto) });

      await expect(service.execute(DTO, 'u1')).rejects.toBe(roto);
    });
  });

  describe('red de seguridad del cierre', () => {
    it('si el cobro dejó saldo cero pero la cuenta sigue abierta, la cierra', async () => {
      // Pasa de verdad: `addPayment` escribe el cobro y **después** cierra, y un reenvío que sale
      // por el atajo de `clientRequestId` devuelve el resumen sin volver a cerrar. Sin cierre no
      // hay consumo de stock, nunca.
      const { service, orders } = build();

      await service.execute(DTO, 'u1');

      expect(orders.closeFromPayment).toHaveBeenCalledWith(DTO.id, 'u1');
    });

    it('pero no la cierra si todavía queda saldo', async () => {
      const { service, orders } = build({
        summary: jest.fn().mockResolvedValue({ total: 100, paid: 40, remaining: 60 }),
      });

      await service.execute(DTO, 'u1');

      expect(orders.closeFromPayment).not.toHaveBeenCalled();
    });
  });

  it('la cuenta nace sin mesa, etiquetada y con origen de mostrador', async () => {
    const { service, orders } = build();

    await service.execute(DTO, 'u1');

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Mostrador', source: 'counter' }),
      'u1',
    );
  });

  it('respeta una etiqueta propia, para distinguir dos mostradores', async () => {
    const { service, orders } = build();

    await service.execute({ ...DTO, label: 'Barra' }, 'u1');

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Barra' }),
      'u1',
    );
  });
});
