import { describe, expect, it } from 'vitest';
import type { Order, RestaurantTable } from '@loklflow/types';
import type { QueuedOperation } from './outbox';
import { applyPendingToOrder, applyPendingToTables, byPartition } from './apply-pending';

/**
 * La superposición de la cola sobre la copia local.
 *
 * Lo que se prueba aquí es que el mesero **ve** lo que acaba de hacer sin red. Sin esto la
 * operación se encola bien y la pantalla no cambia, así que el operario la vuelve a tocar: un
 * fallo que no rompe nada y hace desconfiar de todo.
 */

const op = (over: Partial<QueuedOperation>): QueuedOperation => ({
  id: 'x',
  kind: 'order.status',
  partition: 'order:o1',
  method: 'PATCH',
  path: '/orders/o1/status',
  occurredAt: new Date().toISOString(),
  seq: 1,
  createdAt: Date.now(),
  attempts: 0,
  status: 'pending',
  ...over,
});

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    orderNumber: 12,
    status: 'preparing',
    subtotal: 200,
    discountAmount: 0,
    tipAmount: 0,
    total: 200,
    items: [
      { id: 'i1', productId: 'p1', quantity: 2, unitPrice: 50, subtotal: 100, status: 'pending', notes: null },
      { id: 'i2', productId: 'p2', quantity: 1, unitPrice: 100, subtotal: 100, status: 'pending', notes: null },
    ],
    ...over,
  }) as Order;

const table = (over: Partial<RestaurantTable> = {}): RestaurantTable =>
  ({ id: 't1', number: 4, status: 'available', ...over }) as RestaurantTable;

describe('superponer la cola sobre la copia local', () => {
  describe('mesas', () => {
    it('enseña el estado encolado, no el del servidor', () => {
      const [result] = applyPendingToTables(
        [table()],
        [op({ kind: 'table.status', partition: 'table:t1', body: { status: 'occupied' } })],
      );

      expect(result.status).toBe('occupied');
      expect(result.pendingSync).toBe(true);
    });

    it('deja intactas las mesas sin operaciones pendientes', () => {
      const [result] = applyPendingToTables([table()], []);

      expect(result.status).toBe('available');
      expect(result.pendingSync).toBeUndefined();
    });

    it('gana la última operación encolada de la misma mesa', () => {
      const [result] = applyPendingToTables(
        [table()],
        [
          op({ kind: 'table.status', partition: 'table:t1', body: { status: 'occupied' }, seq: 1 }),
          op({ kind: 'table.status', partition: 'table:t1', body: { status: 'cleaning' }, seq: 2 }),
        ],
      );

      expect(result.status).toBe('cleaning');
    });
  });

  describe('cuentas', () => {
    it('enseña el estado encolado de la comanda', () => {
      const result = applyPendingToOrder(order(), [op({ body: { status: 'ready' } })]);

      expect(result?.status).toBe('ready');
      expect(result?.pendingSync).toBe(true);
    });

    it('enseña el estado encolado de una línea suelta', () => {
      const result = applyPendingToOrder(order(), [
        op({
          kind: 'orderItem.status',
          path: '/orders/o1/items/i2/status',
          body: { status: 'ready' },
        }),
      ]);

      expect(result?.items?.find((i) => i.id === 'i2')?.status).toBe('ready');
      expect(result?.items?.find((i) => i.id === 'i1')?.status).toBe('pending');
    });

    it('recalcula el subtotal de la línea y el total al cambiar la cantidad', () => {
      const result = applyPendingToOrder(order(), [
        op({ kind: 'order.updateItem', path: '/orders/o1/items/i1', body: { quantity: 4 } }),
      ]);

      const item = result?.items?.find((i) => i.id === 'i1');
      expect(item?.quantity).toBe(4);
      // Con el precio ya guardado en la línea, que es dato del servidor: 4 × 50.
      expect(item?.subtotal).toBe(200);
      expect(result?.total).toBe(300);
    });

    it('quita la línea borrada y baja el total', () => {
      const result = applyPendingToOrder(order(), [
        op({ kind: 'order.removeItem', method: 'DELETE', path: '/orders/o1/items/i1' }),
      ]);

      expect(result?.items).toHaveLength(1);
      expect(result?.total).toBe(100);
    });

    it('los ítems cancelados no suman al total', () => {
      const withCancelled = order({
        items: [
          { id: 'i1', productId: 'p1', quantity: 1, unitPrice: 50, subtotal: 50, status: 'cancelled', notes: null },
          { id: 'i2', productId: 'p2', quantity: 1, unitPrice: 100, subtotal: 100, status: 'pending', notes: null },
        ],
      } as Partial<Order>);

      const result = applyPendingToOrder(withCancelled, [
        op({ kind: 'order.updateItem', path: '/orders/o1/items/i2', body: { quantity: 1 } }),
      ]);

      expect(result?.total).toBe(100);
    });

    /**
     * El descuento y la propina nunca se difieren, así que sus valores vienen siempre del
     * servidor. Suponerlos aquí sería enseñar un total que nadie ha cobrado.
     */
    it('respeta el descuento y la propina que fijó el servidor', () => {
      const conDescuento = order({ discountAmount: 20, tipAmount: 30, total: 210 });

      const result = applyPendingToOrder(conDescuento, [
        op({ kind: 'order.updateItem', path: '/orders/o1/items/i1', body: { quantity: 2 } }),
      ]);

      expect(result?.discountAmount).toBe(20);
      expect(result?.tipAmount).toBe(30);
      expect(result?.total).toBe(210);
    });

    it('sin operaciones pendientes devuelve la cuenta tal cual, sin recalcular nada', () => {
      const original = order({ total: 999 });

      const result = applyPendingToOrder(original, []);

      expect(result?.total).toBe(999);
      expect(result?.pendingSync).toBeUndefined();
    });

    it('una ruta que no encaja no rompe ni cambia nada', () => {
      const result = applyPendingToOrder(order(), [
        op({ kind: 'orderItem.status', path: '/otra/cosa', body: { status: 'ready' } }),
      ]);

      expect(result?.items?.every((i) => i.status === 'pending')).toBe(true);
    });
  });

  it('agrupa la cola por partición', () => {
    const groups = byPartition([
      op({ partition: 'order:o1', seq: 1 }),
      op({ partition: 'order:o2', seq: 2 }),
      op({ partition: 'order:o1', seq: 3 }),
    ]);

    expect(groups.get('order:o1')).toHaveLength(2);
    expect(groups.get('order:o2')).toHaveLength(1);
  });
});
