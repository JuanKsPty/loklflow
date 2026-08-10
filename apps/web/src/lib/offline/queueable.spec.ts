import { describe, expect, it } from 'vitest';
import {
  ALL_OPERATION_KINDS,
  isQueueable,
  whyNotQueueable,
  type OperationKind,
} from './queueable';

/**
 * Este spec es lo más valioso que produce el núcleo offline.
 *
 * Es lo único que impide que, cuando llegue el bloque del mesero sin conexión, alguien
 * —incluido yo— cablee por descuido una operación que mueve dinero. Cada `false` de aquí
 * abajo es un fallo que no va a ocurrir en un salón lleno.
 */
describe('qué se puede diferir sin conexión', () => {
  describe('nunca, aunque el mesero insista', () => {
    it.each([
      ['cobrar', 'payment.add'],
      ['la propina', 'order.tip'],
      ['pedir un descuento', 'discount.request'],
      ['abrir turno', 'shift.open'],
      ['cerrar turno', 'shift.close'],
    ] as const)('%s', (_caso, kind) => {
      expect(isQueueable({ kind })).toBe(false);
    });

    /**
     * El bloque 0 le quitó al mesero el botón «Cerrada» porque cerraba sin comprobar pagos.
     * Encolar un cierre sería la misma pérdida de dinero, solo que diferida.
     */
    it('cerrar una cuenta', () => {
      expect(isQueueable({ kind: 'order.status', status: 'closed' })).toBe(false);
    });

    it('cancelar una cuenta', () => {
      expect(isQueueable({ kind: 'order.status', status: 'cancelled' })).toBe(false);
    });

    it('y siempre se puede explicar por qué', () => {
      for (const kind of ALL_OPERATION_KINDS) {
        const reason = whyNotQueueable({ kind });
        if (reason !== undefined) expect(reason.length).toBeGreaterThan(20);
      }
    });
  });

  describe('sí, porque solo describen lo que ya pasó en el salón', () => {
    it.each([
      ['crear la comanda', { kind: 'order.create' as OperationKind }],
      ['añadir un ítem', { kind: 'order.addItem' as OperationKind }],
      ['corregir la cantidad', { kind: 'order.updateItem' as OperationKind }],
      ['quitar un ítem', { kind: 'order.removeItem' as OperationKind }],
      ['pasar a preparación', { kind: 'order.status' as OperationKind, status: 'preparing' }],
      ['marcar lista', { kind: 'order.status' as OperationKind, status: 'ready' }],
      ['marcar entregada', { kind: 'order.status' as OperationKind, status: 'delivered' }],
      ['el estado de un ítem', { kind: 'orderItem.status' as OperationKind }],
      ['ocupar una mesa', { kind: 'table.status' as OperationKind, status: 'occupied' }],
    ])('%s', (_caso, op) => {
      expect(isQueueable(op)).toBe(true);
    });
  });

  describe('estados de mesa', () => {
    it('no se difiere reservar ni mantenimiento: dependen de lo que sepan los demás', () => {
      expect(isQueueable({ kind: 'table.status', status: 'reserved' })).toBe(false);
      expect(isQueueable({ kind: 'table.status', status: 'maintenance' })).toBe(false);
    });
  });

  /**
   * El caso que se escapa fácil: una operación que lleva estado y llega sin él. Aceptarla
   * «porque el tipo está en la lista» dejaría pasar un `closed` sin comprobar.
   */
  it('una operación con estado y sin estado concreto no se difiere', () => {
    expect(isQueueable({ kind: 'order.status' })).toBe(false);
    expect(isQueueable({ kind: 'table.status' })).toBe(false);
  });

  it('un tipo desconocido no se difiere', () => {
    expect(isQueueable({ kind: 'order.explode' as OperationKind })).toBe(false);
  });

  /**
   * Guardarraíl contra el descuido de mañana: si alguien añade una operación a la tabla,
   * este test le obliga a decidir de qué lado está en vez de heredar un valor por defecto.
   */
  it('toda operación conocida tiene una decisión explícita', () => {
    expect(ALL_OPERATION_KINDS.length).toBeGreaterThan(0);
    for (const kind of ALL_OPERATION_KINDS) {
      const queueable = isQueueable({ kind });
      const reason = whyNotQueueable({ kind });
      // O se difiere, o hay un motivo escrito. Nunca las dos ni ninguna.
      expect(queueable ? reason === undefined : typeof reason === 'string').toBe(true);
    }
  });
});
