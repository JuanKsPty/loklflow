import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, OfflineError } from '@/lib/api/client';
import { CACHE, OUTBOX, clear, resetConnection } from './db';
import { list, pending } from './outbox';
import { ALL_OPERATION_KINDS, isQueueable, type OperationKind } from './queueable';
import { flush, mutate } from './mutate';

/**
 * El punto donde se decide si una acción del salón se envía, se guarda o se rechaza.
 *
 * Se simulan los dos módulos que hablan con la red —el cliente HTTP y la sonda— y **no** se
 * simula la cola: lo que hay que comprobar es qué acaba escrito en IndexedDB, que es lo único
 * que sobrevive a un cierre de la pestaña.
 */

// `vi.mock` se iza al principio del archivo, así que los dobles tienen que crearse dentro de
// `vi.hoisted` o la fábrica se ejecuta antes de que existan.
const { api, replayApi, probe } = vi.hoisted(() => ({
  api: { post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  replayApi: { post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  probe: vi.fn(),
}));

// Se conserva lo real salvo los dos clientes: `ApiError` y `OfflineError` son clases, y
// sustituirlas por dobles rompería los `instanceof` que deciden qué se encola.
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, api, replayApi };
});

vi.mock('./net', () => ({
  probe,
  isProbablyOnline: () => true,
  onBackOnline: () => () => undefined,
}));

const offline = () => new OfflineError();

describe('mutate', () => {
  beforeEach(async () => {
    resetConnection();
    await clear(OUTBOX);
    await clear(CACHE);
    vi.clearAllMocks();
  });

  const addItem = (over: Partial<Parameters<typeof mutate>[0]> = {}) =>
    mutate({
      kind: 'order.addItem',
      partition: 'order:1',
      method: 'POST',
      path: '/orders/1/items',
      body: { productId: 'p1', quantity: 1 },
      ...over,
    });

  describe('con servidor al otro lado', () => {
    it('envía y devuelve lo que contestó el servidor, sin tocar la cola', async () => {
      api.post.mockResolvedValue({ id: 'o1' });

      const result = await addItem();

      expect(result).toEqual({ outcome: 'sent', data: { id: 'o1' } });
      expect(await list()).toHaveLength(0);
    });

    /**
     * La distinción que define el módulo: que el servidor conteste «no» es una respuesta, no
     * una falta de red. Encolarla sería pedirle mil veces que acepte algo que ya rechazó.
     */
    it('relanza el error del servidor y no lo encola', async () => {
      api.post.mockRejectedValue(new ApiError(400, 'producto inexistente'));

      await expect(addItem()).rejects.toBeInstanceOf(ApiError);
      expect(await list()).toHaveLength(0);
    });
  });

  describe('sin red', () => {
    it('encola con la partición, el método, la ruta y el cuerpo intactos', async () => {
      api.post.mockRejectedValue(offline());

      const result = await addItem();

      expect(result.outcome).toBe('queued');
      const [op] = await pending();
      expect(op).toMatchObject({
        kind: 'order.addItem',
        partition: 'order:1',
        method: 'POST',
        path: '/orders/1/items',
        body: { productId: 'p1', quantity: 1 },
        status: 'pending',
        attempts: 0,
      });
      // Sella la hora del hecho al encolar, no al enviar: es lo que impide que el informe de
      // tiempos de preparación mida cuándo volvió el WiFi.
      expect(Number.isNaN(Date.parse(op.occurredAt))).toBe(false);
    });

    /**
     * La barandilla del dinero, y la aserción más importante de este archivo. Cobrar exige el
     * total real de la cuenta, que puede haber cambiado desde otro dispositivo: diferirlo
     * dejaría al cajero con el cajón cuadrado y la cuenta abierta.
     */
    it('rechaza un cobro y no deja nada en la cola', async () => {
      api.post.mockRejectedValue(offline());

      const result = await mutate({
        kind: 'payment.add',
        partition: 'order:1',
        method: 'POST',
        path: '/orders/1/payments',
        body: { amount: 250, method: 'cash' },
      });

      expect(result.outcome).toBe('rejected');
      expect(result).toHaveProperty('reason', expect.stringContaining('total real'));
      expect(await list()).toHaveLength(0);
    });

    it('difiere un estado de cocina pero no el cierre de la cuenta', async () => {
      api.patch.mockRejectedValue(offline());
      const status = (value: string) =>
        mutate({
          kind: 'order.status',
          partition: 'order:1',
          method: 'PATCH',
          path: '/orders/1/status',
          body: { status: value },
        });

      expect((await status('ready')).outcome).toBe('queued');
      expect((await status('closed')).outcome).toBe('rejected');
      expect((await status('cancelled')).outcome).toBe('rejected');
      expect(await list()).toHaveLength(1);
    });

    it('difiere ocupar o limpiar una mesa, pero no reservarla', async () => {
      api.patch.mockRejectedValue(offline());
      const status = (value: string) =>
        mutate({
          kind: 'table.status',
          partition: 'table:5',
          method: 'PATCH',
          path: '/tables/5/status',
          body: { status: value },
        });

      expect((await status('occupied')).outcome).toBe('queued');
      expect((await status('reserved')).outcome).toBe('rejected');
      expect((await status('maintenance')).outcome).toBe('rejected');
    });

    /**
     * Guardián sobre la tabla entera: cualquier tipo nuevo marcado como no diferible tiene que
     * salir rechazado **y con la cola vacía**. Sin este bucle, añadir un tipo y olvidarse de la
     * rama que lo rechaza se descubriría con una operación de dinero encolada.
     */
    it('ninguna operación no diferible deja rastro en la cola', async () => {
      const noQueueables = ALL_OPERATION_KINDS.filter(
        (kind: OperationKind) => !isQueueable({ kind }),
      );
      expect(noQueueables.length).toBeGreaterThan(0);

      for (const kind of noQueueables) {
        api.post.mockRejectedValue(offline());
        api.patch.mockRejectedValue(offline());
        const result = await mutate({
          kind,
          partition: 'order:1',
          method: 'POST',
          path: '/loquesea',
        });
        expect(result.outcome).toBe('rejected');
      }

      expect(await list()).toHaveLength(0);
    });
  });

  describe('flush', () => {
    it('no drena si la sonda dice que no hay servidor', async () => {
      api.post.mockRejectedValue(offline());
      await addItem();
      probe.mockResolvedValue(false);

      const result = await flush();

      expect(result).toEqual({ sent: 0, failed: 0, retry: 0, needsAuth: false });
      expect(replayApi.post).not.toHaveBeenCalled();
      expect(await pending()).toHaveLength(1);
    });

    it('reenvía por replayApi y adjunta la hora del hecho', async () => {
      api.post.mockRejectedValue(offline());
      await addItem();
      probe.mockResolvedValue(true);
      replayApi.post.mockResolvedValue({ id: 'o1' });

      const result = await flush();

      expect(result.sent).toBe(1);
      const [path, body] = replayApi.post.mock.calls[0];
      expect(path).toBe('/orders/1/items');
      expect(body).toMatchObject({ productId: 'p1', quantity: 1 });
      expect(body).toHaveProperty('occurredAt');
      expect(await list()).toHaveLength(0);
    });

    /**
     * `api.delete` no acepta cuerpo, así que la hora se calcula y se tira. Comprobarlo evita
     * que un futuro refactor la «arregle» pasándola y se encuentre un 400.
     */
    it('un borrado se reenvía sin cuerpo', async () => {
      api.delete.mockRejectedValue(offline());
      await mutate({
        kind: 'order.removeItem',
        partition: 'order:1',
        method: 'DELETE',
        path: '/orders/1/items/9',
      });
      probe.mockResolvedValue(true);
      replayApi.delete.mockResolvedValue(undefined);

      await flush();

      expect(replayApi.delete).toHaveBeenCalledWith('/orders/1/items/9');
    });

    it('un 401 al reenviar detiene el drenado y lo dice', async () => {
      api.post.mockRejectedValue(offline());
      await addItem();
      probe.mockResolvedValue(true);
      replayApi.post.mockRejectedValue(new ApiError(401, 'Sesión caducada'));

      const result = await flush();

      expect(result.needsAuth).toBe(true);
      expect(result.failed).toBe(0);
      expect(await pending()).toHaveLength(1);
    });
  });
});
