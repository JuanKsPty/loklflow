import type { OrderStatus } from '@loklflow/types';

/**
 * Qué operaciones se pueden diferir cuando no hay conexión, y cuáles no. **Nunca**.
 *
 * Esta tabla es la pieza más importante del núcleo offline, y no por lo que permite sino por
 * lo que prohíbe. La regla que la ordena: **se difiere lo que solo describe lo que ya pasó en
 * el salón; no se difiere nada que mueva dinero o que dependa de un estado que este dispositivo
 * no puede conocer.**
 *
 * Un ejemplo de cada lado. Añadir un ítem a una comanda es un hecho: el mesero lo apuntó, la
 * cocina lo hará, y que el servidor se entere ahora o en diez minutos no cambia nada. Cobrar,
 * en cambio, exige saber el total real de la cuenta, y ese total puede haber cambiado desde
 * otro dispositivo mientras este estaba aislado: cobrar contra un total viejo deja la cuenta
 * abierta con el cajón diciendo que está saldada.
 *
 * Cerrar y cancelar están fuera por el mismo motivo por el que el bloque 0 le quitó el botón
 * «Cerrada» al mesero: encolar un cierre es una forma diferida de cerrar cuentas sin cobrar.
 */

/** Operaciones que el cliente sabe nombrar. El servidor no conoce estos nombres. */
export type OperationKind =
  | 'order.create'
  | 'order.addItem'
  | 'order.updateItem'
  | 'order.removeItem'
  | 'order.status'
  | 'orderItem.status'
  | 'table.status'
  | 'payment.add'
  | 'order.tip'
  | 'discount.request'
  | 'shift.open'
  | 'shift.close';

/**
 * De dónde sale la clave que hace segura la reentrega.
 *
 * - `clientId` — el uuid que genera el dispositivo y viaja como clave primaria del recurso.
 * - `clientRequestId` — clave de idempotencia explícita del cuerpo.
 * - `natural` — la operación es idempotente por su propia forma: fijar un estado a X o una
 *   cantidad a N da el mismo resultado se aplique una vez o tres.
 */
export type IdempotencyKind = 'clientId' | 'clientRequestId' | 'natural';

export interface Operation {
  kind: OperationKind;
  /** Estado destino. Solo lo llevan `order.status`, `orderItem.status` y `table.status`. */
  status?: string;
}

interface Rule {
  queueable: boolean;
  idempotency: IdempotencyKind;
  /** Si la operación lleva estado, los únicos valores que se pueden diferir. */
  allowedStatuses?: readonly string[];
  /** Por qué no, en palabras que puedan enseñarse al operario. */
  reason?: string;
}

/**
 * Estados de orden que se pueden encolar.
 *
 * Son los del ciclo de cocina y sala, que describen trabajo ya hecho. `closed` y `cancelled`
 * quedan fuera: el primero mueve dinero, y el segundo libera la mesa y anula una comanda que
 * la cocina puede haber empezado, decisiones que necesitan ver el estado real de la cuenta.
 */
const QUEUEABLE_ORDER_STATUSES = ['preparing', 'ready', 'delivered'] as const satisfies readonly OrderStatus[];

/** Estados de mesa que se pueden encolar. Ver la nota de `table.status` abajo. */
const QUEUEABLE_TABLE_STATUSES = ['occupied', 'cleaning', 'available'] as const;

const RULES: Record<OperationKind, Rule> = {
  // ─── Se difieren: describen lo que ya ocurrió en el salón ────────────────────
  'order.create': { queueable: true, idempotency: 'clientId' },
  'order.addItem': { queueable: true, idempotency: 'clientId' },
  // Fijar la cantidad a N es idempotente. No lo es *conmutativo* con el resto de
  // operaciones de la misma cuenta, y de ahí que la cola respete el orden por partición.
  'order.updateItem': { queueable: true, idempotency: 'natural' },
  // Un segundo borrado responde 404, que la cola trata como terminal y descarta sin ruido.
  'order.removeItem': { queueable: true, idempotency: 'natural' },
  'order.status': {
    queueable: true,
    idempotency: 'natural',
    allowedStatuses: QUEUEABLE_ORDER_STATUSES,
    reason:
      'Cerrar o cancelar una cuenta necesita ver los pagos y el estado real, y sin conexión ' +
      'este dispositivo no los tiene.',
  },
  'orderItem.status': { queueable: true, idempotency: 'natural' },
  'table.status': {
    queueable: true,
    idempotency: 'natural',
    allowedStatuses: QUEUEABLE_TABLE_STATUSES,
    reason:
      'Reservar o poner una mesa en mantenimiento son decisiones que dependen de lo que ' +
      'sepan los demás dispositivos.',
  },

  // ─── No se difieren, nunca ───────────────────────────────────────────────────
  'payment.add': {
    queueable: false,
    idempotency: 'clientRequestId',
    reason:
      'Cobrar exige el total real de la cuenta, y puede haber cambiado desde otro ' +
      'dispositivo. Cobrar contra un total viejo la deja abierta con el cajón cuadrado.',
  },
  'order.tip': {
    queueable: false,
    idempotency: 'natural',
    reason: 'La propina cambia el total de una cuenta que se está cobrando.',
  },
  'discount.request': {
    queueable: false,
    idempotency: 'natural',
    reason: 'Un descuento necesita la aprobación de un rol con umbral suficiente, en línea.',
  },
  'shift.open': {
    queueable: false,
    idempotency: 'natural',
    reason:
      'Solo puede haber un turno abierto por cajero, y eso lo garantiza un índice de la base ' +
      'de datos que este dispositivo no puede consultar sin conexión.',
  },
  'shift.close': {
    queueable: false,
    idempotency: 'natural',
    reason:
      'El arqueo tiene que contar todo lo cobrado. Cerrarlo con operaciones sin enviar haría ' +
      'que el cajero firmara una diferencia falsa.',
  },
};

/** Si la operación se puede diferir tal cual viene, con su estado incluido. */
export function isQueueable(op: Operation): boolean {
  const rule = RULES[op.kind];
  if (!rule || !rule.queueable) return false;
  if (!rule.allowedStatuses) return true;
  // Una operación con estado y sin estado concreto no se difiere: no se puede comprobar.
  return op.status !== undefined && rule.allowedStatuses.includes(op.status);
}

/** Por qué no se pudo diferir, para poder decírselo al operario en vez de fallar en silencio. */
export function whyNotQueueable(op: Operation): string | undefined {
  if (isQueueable(op)) return undefined;
  return RULES[op.kind]?.reason ?? 'Esta operación necesita conexión.';
}

export function idempotencyOf(kind: OperationKind): IdempotencyKind {
  return RULES[kind].idempotency;
}

/** Todas las operaciones que el cliente sabe nombrar. Existe para que los tests las recorran. */
export const ALL_OPERATION_KINDS = Object.keys(RULES) as OperationKind[];
