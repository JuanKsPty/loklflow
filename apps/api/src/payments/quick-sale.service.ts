import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';
import { ShiftsService } from '../shifts/shifts.service';
import { QuickSaleDto } from './dto/quick-sale.dto';

/** El mismo que usan `PaymentsService`, `DiscountsService` y `OrdersService`. */
const MONEY_EPSILON = 0.001;

/**
 * La venta de mostrador: elegir productos, cobrar y cerrar, en una sola petición.
 *
 * Vive en `payments/` y no en `orders/` porque necesita los dos servicios, y `PaymentsModule` ya
 * importa `OrdersModule`: al revés habría ciclo. Es el único sitio donde ambos existen sin
 * `forwardRef`.
 *
 * Se compone en el servidor —y no en el cliente con dos llamadas— porque un teléfono con datos
 * flojos puede dejar la primera hecha y la segunda no, y eso es una cuenta abierta y sin cobrar
 * que nadie sabe que existe.
 */
@Injectable()
export class QuickSaleService {
  private readonly logger = new Logger(QuickSaleService.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly shifts: ShiftsService,
  ) {}

  async execute(dto: QuickSaleDto, userId: string) {
    /**
     * **El turno, antes de crear nada.**
     *
     * `addPayment` lo vuelve a comprobar, así que esto parece redundante. No lo es: si se dejara
     * solo allí, la orden ya existiría cuando salta el error y quedaría una cuenta de mostrador
     * abierta —sin mesa, sin nadie mirándola— engordando «cuentas por cobrar» hasta que alguien la
     * cancelara a mano. El fallo más probable de este endpoint es el primer uso del día, y así no
     * deja basura.
     */
    const shift = await this.shifts.currentForUser(userId);
    if (!shift) {
      throw new BadRequestException(
        'No hay un turno de caja abierto. Abre tu turno para registrar la venta.',
      );
    }

    const order = await this.orders.create(
      {
        id: dto.id,
        label: dto.label ?? 'Mostrador',
        source: 'counter',
        occurredAt: dto.occurredAt,
        items: dto.items,
      },
      userId,
    );

    /**
     * Salidas tempranas, y no son decoración.
     *
     * Si la venta ya se cobró y cerró, esto es un reenvío completo. Sin esta línea, un reintento
     * con el mismo `id` pero **otro** `clientRequestId` —un cliente que regenera la clave— llegaría
     * a `addPayment`, que respondería «la cuenta ya está cerrada», y el operario vería un error
     * sobre una venta que sí se hizo.
     */
    if (order.status === 'closed') return this.result(order.id);
    if (order.status === 'cancelled') {
      throw new BadRequestException(
        `La venta #${order.orderNumber} se canceló. Registra una nueva.`,
      );
    }

    const total = Number(order.total);
    if (total < MONEY_EPSILON) {
      // `CreatePaymentDto.amount` es `@Min(0.01)`, y el otro camino tampoco sirve:
      // `ALLOWED_TRANSITIONS` no deja pasar de `pending` a `closed` de un salto. Mejor decirlo que
      // dejar salir un 400 de validación sin explicación.
      throw new BadRequestException('Una venta de mostrador necesita un importe mayor que cero.');
    }

    try {
      await this.payments.addPayment(
        order.id,
        {
          method: dto.payment.method,
          amount: total,
          reference: dto.payment.reference,
          // Con espacio de nombres para que no pueda chocar con un `clientRequestId` que el mismo
          // dispositivo use en otro cobro. Cabe de sobra en `varchar(64)`.
          clientRequestId: dto.clientRequestId ?? `quick-sale:${dto.id}`,
        },
        userId,
      );
    } catch (err) {
      /**
       * **La orden se queda. No se compensa.**
       *
       * Cancelarla sería peor por tres motivos concretos: quema un número de cuenta, mete una
       * cancelación en la bitácora por cada parpadeo de red y —el que decide— **rompe el
       * reintento**: el cliente vuelve a mandar el mismo `id` y se encontraría una cuenta
       * cancelada, que es un error definitivo. Con la orden en pie, repetir la misma petición la
       * retoma justo donde se quedó.
       *
       * El número de cuenta va **dentro del texto**: `HttpExceptionFilter` descarta cualquier
       * campo del cuerpo de error que no sea `message`, así que si no va ahí la pantalla no tiene
       * forma de decirle al operario qué venta quedó a medias.
       */
      this.logger.warn({
        event: 'quick-sale:payment-failed',
        orderId: order.id,
        orderNumber: order.orderNumber,
        error: err instanceof Error ? err.message : String(err),
      });
      if (err instanceof BadRequestException) {
        throw new BadRequestException(
          `${messageOf(err)} La venta quedó abierta como cuenta #${order.orderNumber}: ` +
            'reintenta desde la misma pantalla o cóbrala en el punto de venta.',
        );
      }
      throw err; // un 500 sigue siendo un 500: no se disfraza de error de negocio
    }

    /**
     * Red de seguridad del cierre. No es teórica.
     *
     * `addPayment` escribe el cobro y **después** llama a `closeFromPayment`. Si el proceso muere
     * entre las dos cosas, o si este cobro fue un reenvío que salió por el atajo de
     * `clientRequestId` —que devuelve el resumen sin volver a cerrar—, la cuenta se queda abierta
     * con el dinero dentro. Y sin cierre no hay consumo de stock, nunca.
     *
     * `closeFromPayment` es idempotente: si ya está cerrada, sale por su primera línea.
     */
    const summary = await this.payments.summary(order.id);
    if (summary.remaining <= MONEY_EPSILON) {
      await this.orders.closeFromPayment(order.id, userId);
    }

    return this.result(order.id);
  }

  /** La orden cerrada y el resumen de cobro, que es lo que la pantalla necesita para el recibo. */
  private async result(orderId: string) {
    const [order, payment] = await Promise.all([
      this.orders.findOne(orderId),
      this.payments.summary(orderId),
    ]);
    return { order, payment };
  }
}

/** El texto de un `BadRequestException`, que Nest guarda como string o dentro de un objeto. */
function messageOf(err: BadRequestException): string {
  const response = err.getResponse();
  if (typeof response === 'string') return response;
  const message = (response as { message?: string | string[] }).message;
  if (Array.isArray(message)) return message.join('. ');
  return message ?? err.message;
}
