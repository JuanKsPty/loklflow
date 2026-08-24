import type { OrderSource, OrderStatus } from './order-status.constants';

/**
 * Las reglas de qué se puede fusionar con qué.
 *
 * Función pura, sin TypeORM, siguiendo la convención del repo (`order-totals.ts`, `csv.ts`): la
 * lógica que decide si dos cuentas se pueden juntar se prueba sin base de datos.
 *
 * **La precondición que define la funcionalidad: no se fusiona una cuenta con pagos, descuento o
 * propina.** No es una limitación por comodidad, es la regla correcta de producto —«junta la 4 y la
 * 5» se pide *antes* de cobrar, no después— y hace que los dos problemas difíciles desaparezcan en
 * lugar de resolverse a medias:
 *
 * - `payments.service.ts` valida cada cobro contra el saldo restante. Una cuenta origen con pagos
 *   parciales cuyos ítems se mudan a otra dejaría un cobro sin nada que cobrar y un saldo imposible
 *   de reconciliar. **Imposible por construcción.**
 * - `discounts.service.ts` rechaza un descuento que deje el total por debajo de lo ya cobrado. Un
 *   descuento aprobado sobre una cuenta que se vacía es exactamente ese caso. **Imposible por
 *   construcción.**
 *
 * Un descuento en la cuenta **destino** sí es válido: se conserva y `computeTotals` lo recalcula
 * sobre el total nuevo.
 */

const OPEN_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered'];

/** Lo mínimo que hace falta saber de una cuenta para decidir. */
export interface MergeCandidate {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  source: OrderSource;
  tableId: string | null;
  mergedIntoOrderId: string | null;
  paidAmount: number;
  discountAmount: number;
  tipAmount: number;
}

export type MergeVerdict = { ok: true } | { ok: false; reason: string };

/** Tolerancia de centavos, igual que en `PaymentsService` y `DiscountsService`. */
const MONEY_EPSILON = 0.001;

export function canMerge(source: MergeCandidate, target: MergeCandidate): MergeVerdict {
  if (source.id === target.id) {
    return { ok: false, reason: 'Una cuenta no se puede fusionar consigo misma.' };
  }

  /**
   * Una venta de mostrador se cobra sola y en el acto, así que la única forma de encontrarse una
   * abierta es que su cobro fallara. En ese caso lo que toca es reintentar la venta o cobrarla en
   * el punto de venta — no mudarle las líneas a la cuenta de una mesa, donde el importe aparecería
   * como consumo de unos clientes que no pidieron eso.
   */
  if (source.source === 'counter' || target.source === 'counter') {
    return {
      ok: false,
      reason: 'Una venta de mostrador no se fusiona: cóbrala o cancélala.',
    };
  }

  if (!OPEN_STATUSES.includes(target.status)) {
    return {
      ok: false,
      reason: `La cuenta #${target.orderNumber} ya está cerrada o cancelada.`,
    };
  }

  if (!OPEN_STATUSES.includes(source.status)) {
    return {
      ok: false,
      reason: `La cuenta #${source.orderNumber} ya está cerrada o cancelada.`,
    };
  }

  // Una cuenta ya fusionada no tiene ítems que mover y apunta a otra: encadenarlas haría que
  // deshacer dejara de tener un resultado único.
  if (source.mergedIntoOrderId !== null) {
    return {
      ok: false,
      reason: `La cuenta #${source.orderNumber} ya está fusionada en otra.`,
    };
  }

  if (target.mergedIntoOrderId !== null) {
    return {
      ok: false,
      reason: `La cuenta #${target.orderNumber} está fusionada en otra: fusiona sobre la principal.`,
    };
  }

  if (source.paidAmount > MONEY_EPSILON) {
    return {
      ok: false,
      reason: `La cuenta #${source.orderNumber} ya tiene pagos registrados. Cóbrala aparte o anula el pago antes de fusionar.`,
    };
  }

  if (source.discountAmount > MONEY_EPSILON) {
    return {
      ok: false,
      reason: `La cuenta #${source.orderNumber} tiene un descuento aplicado. Quítalo antes de fusionar.`,
    };
  }

  if (source.tipAmount > MONEY_EPSILON) {
    return {
      ok: false,
      reason: `La cuenta #${source.orderNumber} tiene propina registrada. Quítala antes de fusionar.`,
    };
  }

  // **No se exige que sean de la misma mesa**: juntar cuentas de mesas distintas es literalmente
  // lo que pide «fusión de mesas». Que sean de la misma también vale.
  return { ok: true };
}

/**
 * Ancla para encontrar todos los sitios que tienen que excluir las cuentas fusionadas.
 *
 * Se exporta como constante y no se escribe a mano en cada consulta para que un `grep` la
 * encuentre entera: **olvidar uno de esos sitios en los reportes duplica las ventas**, y es un
 * fallo que no rompe nada visible — solo hace que los números del dueño estén mal.
 */
export const NOT_MERGED_SQL = 'o.merged_into_order_id IS NULL';
