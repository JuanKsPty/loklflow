import { beforeEach, describe, expect, it } from 'vitest';
import { CACHE, OUTBOX, cache, clear, db, isSupported, outbox, resetConnection } from './db';

/**
 * El almacén local.
 *
 * El almacén `cache` se declaró en la versión 1 del esquema sin que nada lo escribiera, para
 * no tener que subir la versión —y migrar dispositivos con datos— cuando llegara la lectura
 * sin conexión. Esto comprueba que la promesa se cumple: que la clave compuesta funciona y
 * que el almacén está de verdad ahí, no solo en el comentario.
 */
describe('almacenamiento local', () => {
  beforeEach(async () => {
    resetConnection();
    await clear(OUTBOX);
    await clear(CACHE);
  });

  it('reconoce que hay IndexedDB en este entorno', () => {
    expect(isSupported()).toBe(true);
  });

  it('reutiliza la misma conexión en vez de abrir una por llamada', () => {
    expect(db()).toBe(db());
  });

  it('declara los dos almacenes desde la versión 1', () => {
    expect(db().tables.map((t) => t.name).sort()).toEqual(['cache', 'outbox']);
  });

  describe('almacén de caché', () => {
    const row = (collection: string, id: string, value: unknown) => ({
      collection,
      id,
      value,
      updatedAt: Date.now(),
    });

    it('guarda y devuelve por la clave compuesta', async () => {
      await cache().put(row('orders', 'o1', { total: 250 }));

      const found = await cache().get(['orders', 'o1']);

      expect(found?.value).toEqual({ total: 250 });
    });

    // La clave es `[collection+id]` y no `id` a propósito: la mesa 1 y la orden 1 conviven sin
    // pisarse, que es lo que permite guardar varias colecciones en un solo almacén.
    it('el mismo id en dos colecciones no se pisa', async () => {
      await cache().put(row('orders', '1', 'una orden'));
      await cache().put(row('tables', '1', 'una mesa'));

      expect((await cache().get(['orders', '1']))?.value).toBe('una orden');
      expect((await cache().get(['tables', '1']))?.value).toBe('una mesa');
    });

    it('vuelve a escribir sobre la misma clave en vez de duplicar', async () => {
      await cache().put(row('orders', 'o1', { total: 100 }));
      await cache().put(row('orders', 'o1', { total: 320 }));

      expect(await cache().count()).toBe(1);
      expect((await cache().get(['orders', 'o1']))?.value).toEqual({ total: 320 });
    });

    it('el índice de colección permite leer una entera sin recorrer el resto', async () => {
      await cache().put(row('orders', 'o1', 1));
      await cache().put(row('orders', 'o2', 2));
      await cache().put(row('tables', 't1', 3));

      const orders = await cache().where('collection').equals('orders').toArray();

      expect(orders.map((r) => r.id).sort()).toEqual(['o1', 'o2']);
    });
  });

  it('vaciar un almacén no toca al otro', async () => {
    await cache().put({ collection: 'orders', id: 'o1', value: 1, updatedAt: Date.now() });
    await outbox().add({
      id: 'x',
      kind: 'order.addItem',
      partition: 'order:1',
      method: 'POST',
      path: '/p',
      occurredAt: new Date().toISOString(),
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
    } as Parameters<ReturnType<typeof outbox>['add']>[0]);

    await clear(CACHE);

    expect(await cache().count()).toBe(0);
    expect(await outbox().count()).toBe(1);
  });
});
