import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, OfflineError } from '@/lib/api/client';
import { reportBrowserError } from '@/lib/observability/report';
import { CACHE, OUTBOX, clear, resetConnection } from './db';
import {
  backoffFor,
  discard,
  drain,
  enqueue,
  failed,
  list,
  observePendingCount,
  pending,
  pendingFor,
  requeue,
  requeuePartition,
  type QueuedOperation,
} from './outbox';

// La cola llama a `reportBrowserError` en los caminos que dejan rastro (terminal, agotada,
// descartada). Se espía en vez de dejarlo pasar: que una comanda descartada deje traza es
// parte del contrato, no un efecto secundario.
vi.mock('@/lib/observability/report', () => ({ reportBrowserError: vi.fn() }));

/**
 * La cola contra una IndexedDB real (de mentira, pero real: `fake-indexeddb` implementa la
 * misma API, transacciones incluidas). Lo que se prueba aquí no es que guarde y lea, sino las
 * cuatro garantías de las que depende que no se pierda una comanda.
 */
describe('cola de salida', () => {
  beforeEach(async () => {
    resetConnection();
    await clear(OUTBOX);
    await clear(CACHE);
  });

  const op = (over: Partial<Parameters<typeof enqueue>[0]> = {}) =>
    enqueue({
      kind: 'order.addItem',
      partition: 'order:1',
      method: 'POST',
      path: '/orders/1/items',
      ...over,
    });

  it('conserva el orden de llegada dentro de una partición', async () => {
    const sent: string[] = [];
    await op({ path: '/a' });
    await op({ path: '/b' });
    await op({ path: '/c' });

    await drain(async (o) => {
      sent.push(o.path);
    });

    expect(sent).toEqual(['/a', '/b', '/c']);
    expect(await pending()).toHaveLength(0);
  });

  /**
   * La razón de que la cola sea por partición y no global: una cuenta atascada no puede
   * dejar sin enviar al resto del salón.
   */
  it('un atasco en una cuenta no bloquea a las demás', async () => {
    await op({ partition: 'order:1', path: '/atascada' });
    await op({ partition: 'order:1', path: '/detras-de-la-atascada' });
    await op({ partition: 'order:2', path: '/otra-cuenta' });

    const sent: string[] = [];
    await drain(async (o) => {
      if (o.path === '/atascada') throw new OfflineError();
      sent.push(o.path);
    });

    expect(sent).toEqual(['/otra-cuenta']);
    // La de detrás no se envió: romper el orden sería peor que esperar.
    expect((await pending()).map((o) => o.path).sort()).toEqual([
      '/atascada',
      '/detras-de-la-atascada',
    ]);
  });

  describe('clasificación de errores', () => {
    it('un 400 es terminal: el servidor ya dijo que no', async () => {
      await op();

      await drain(async () => {
        throw new ApiError(400, 'producto inexistente');
      });

      expect(await pending()).toHaveLength(0);
      const tray = await failed();
      expect(tray).toHaveLength(1);
      expect(tray[0].lastError).toContain('producto inexistente');
    });

    it('un fallo de red se reintenta', async () => {
      await op();

      await drain(async () => {
        throw new OfflineError();
      });

      const queue = await pending();
      expect(queue).toHaveLength(1);
      expect(queue[0].attempts).toBe(1);
    });

    it('un 500 se reintenta: el servidor ni siquiera pudo decidir', async () => {
      await op();

      await drain(async () => {
        throw new ApiError(500, 'boom');
      });

      expect(await pending()).toHaveLength(1);
    });

    /**
     * Rendirse no es descartar. Una comanda perdida en silencio es peor que cualquier error
     * visible, así que acaba en la bandeja para que decida una persona.
     */
    it('tras agotar los intentos pasa a la bandeja, no se pierde', async () => {
      await op();
      const fail = async () => {
        throw new OfflineError();
      };

      for (let i = 0; i < 10; i++) {
        // Se adelanta el reloj para saltarse el retroceso entre intentos.
        vi.setSystemTime(Date.now() + 10 * 60_000);
        await drain(fail);
      }
      vi.useRealTimers();

      expect(await pending()).toHaveLength(0);
      expect(await failed()).toHaveLength(1);
    });

    /**
     * El caso amable que la cola prometía en su comentario y no cumplía: quitar una línea que
     * ya no está **es** el resultado que se buscaba. Se daba por fallo definitivo, así que
     * llenaba la bandeja y el log de errores que no lo eran.
     */
    it('un 404 borrando es éxito, no un fallo', async () => {
      await op({ method: 'DELETE', kind: 'order.removeItem', path: '/orders/1/items/9' });

      await drain(async () => {
        throw new ApiError(404, 'Item not found in order');
      });

      expect(await pending()).toHaveLength(0);
      expect(await failed()).toHaveLength(0);
    });

    it('un 404 que no es un borrado sigue siendo terminal', async () => {
      // Un 404 en `POST /orders/:id/items` no dice «ya estaba»: dice que la cuenta no existe.
      await op({ method: 'POST', path: '/orders/desaparecida/items' });

      await drain(async () => {
        throw new ApiError(404, 'Order not found');
      });

      expect(await failed()).toHaveLength(1);
    });

    /**
     * El fallo que borraría un turno entero: con el token caducado, tratar el 401 como
     * terminal manda **la cola completa** a la bandeja en el primer drenado tras el corte.
     */
    it('un 401 detiene el drenado sin marcar nada como fallido', async () => {
      await op({ partition: 'order:1', path: '/a' });
      await op({ partition: 'order:2', path: '/b' });

      const result = await drain(async () => {
        throw new ApiError(401, 'Sesión caducada');
      });

      expect(result.needsAuth).toBe(true);
      expect(result.failed).toBe(0);
      expect(await failed()).toHaveLength(0);
      expect(await pending()).toHaveLength(2);
    });

    it('un 401 no gasta intentos: la operación no hizo nada mal', async () => {
      await op();

      await drain(async () => {
        throw new ApiError(401, 'Sesión caducada');
      });

      expect((await pending())[0].attempts).toBe(0);
    });

    /**
     * En cuanto la API tenga límite de peticiones, la ráfaga de reconexión de una tablet con
     * veinte operaciones lo dispara. Darlo por definitivo sería perder comandas por
     * defenderse de un ataque que nadie estaba haciendo.
     */
    it.each([408, 425, 429])('un %i se reintenta, no termina', async (status) => {
      await op();

      await drain(async () => {
        throw new ApiError(status, 'ahora no');
      });

      expect(await pending()).toHaveLength(1);
      expect(await failed()).toHaveLength(0);
    });
  });

  describe('bandeja de fallos', () => {
    const sendFailing = async () => {
      throw new ApiError(400, 'no');
    };

    it('reintentar devuelve la operación a la cola conservando su orden', async () => {
      await op({ path: '/primera' });
      await op({ path: '/segunda' });
      await drain(sendFailing);

      const tray = await failed();
      const primera = tray.find((o) => o.path === '/primera')!;
      await requeue(primera.seq);

      const queue = await pending();
      expect(queue).toHaveLength(1);
      // `seq` intacto: reencolar con uno nuevo colaría la operación detrás de las posteriores.
      expect(queue[0].seq).toBe(primera.seq);
      expect(queue[0].attempts).toBe(0);
      expect(queue[0].lastError).toBeUndefined();
    });

    it('reintentar una partición devuelve todas sus operaciones de golpe', async () => {
      await op({ partition: 'order:1', path: '/a' });
      await op({ partition: 'order:1', path: '/b' });
      await op({ partition: 'order:2', path: '/c' });
      await drain(sendFailing);

      const moved = await requeuePartition('order:1');

      expect(moved).toBe(2);
      expect((await pending()).map((o) => o.path).sort()).toEqual(['/a', '/b']);
      expect(await failed()).toHaveLength(1);
    });

    it('descartar la saca de la cola y deja rastro', async () => {
      await op();
      await drain(sendFailing);
      const [stuck] = await failed();

      await discard(stuck.seq);

      expect(await list()).toHaveLength(0);
      // Una comanda que alguien decide no enviar es justo lo que después nadie recuerda.
      expect(reportBrowserError).toHaveBeenCalledWith(
        'outbox:discarded',
        expect.any(Error),
        expect.objectContaining({ kind: stuck.kind, partition: stuck.partition }),
      );
    });

    it('reintentar algo que no está en la bandeja no hace nada', async () => {
      await op();
      const [queued] = await pending();

      await requeue(queued.seq);

      expect((await pending())[0].attempts).toBe(0);
      expect(await failed()).toHaveLength(0);
    });
  });

  /**
   * El fallo que se cuela solo: si el reintento tocara la clave de orden, una operación
   * reintentada se colocaría detrás de otras creadas después, y crear la comanda acabaría
   * llegando tras el ítem que le añade.
   */
  it('un reintento no reordena la partición', async () => {
    const first = await op({ path: '/crear' });
    await op({ path: '/anadir-item' });

    await drain(async (o) => {
      if (o.path === '/crear') throw new OfflineError();
    });

    const queue = await pending();
    expect(queue.map((o) => o.path)).toEqual(['/crear', '/anadir-item']);
    expect(queue[0].seq).toBe(first.seq);
    expect(queue[0].lastAttemptAt).toBeGreaterThan(0);
  });

  it('el retroceso crece y tiene tope', () => {
    expect(backoffFor(0)).toBeLessThan(backoffFor(3));
    expect(backoffFor(3)).toBeLessThan(backoffFor(6));
    expect(backoffFor(50)).toBe(backoffFor(60));
  });

  it('espera el retroceso antes de volver a intentar', async () => {
    await op();
    await drain(async () => {
      throw new OfflineError();
    });

    let attempts = 0;
    await drain(async () => {
      attempts += 1;
    });

    // Aún no toca: el retroceso del primer intento no ha pasado.
    expect(attempts).toBe(0);
  });

  /**
   * La hora del hecho, no la del envío. Sin esto el informe de tiempos de preparación mide
   * cuándo volvió el WiFi.
   */
  it('guarda cuándo ocurrió, y sobrevive a los reintentos', async () => {
    const when = '2026-08-10T20:10:00.000Z';
    await op({ occurredAt: when });

    await drain(async () => {
      throw new OfflineError();
    });

    expect((await pending())[0].occurredAt).toBe(when);
  });

  it('cada operación encolada tiene su propio id', async () => {
    await op();
    await op();

    const ids = (await list()).map((o) => o.id);
    expect(new Set(ids).size).toBe(2);
  });

  describe('consultas', () => {
    it('separa lo pendiente de lo que se rindió', async () => {
      await op({ path: '/viva' });
      await op({ path: '/muerta' });

      await drain(async (o) => {
        if (o.path === '/muerta') throw new ApiError(400, 'no');
      });

      expect((await pending()).map((o) => o.path)).toEqual([]);
      expect((await failed()).map((o) => o.path)).toEqual(['/muerta']);
    });

    it('puede pedir lo pendiente de una sola cuenta', async () => {
      await op({ partition: 'order:1', path: '/a' });
      await op({ partition: 'order:2', path: '/b' });
      await op({ partition: 'order:1', path: '/c' });

      expect((await pendingFor('order:1')).map((o) => o.path)).toEqual(['/a', '/c']);
      expect((await pendingFor('order:2')).map((o) => o.path)).toEqual(['/b']);
    });
  });

  /**
   * La otra mitad de la razón para adoptar Dexie: la consulta se reemite sola cuando la cola
   * cambia. De esto dependen el contador de pendientes, la bandeja de fallos y —lo que de
   * verdad importa— el arqueo, que tiene que contar los cobros que aún no han salido.
   */
  it('la consulta viva reemite cuando la cola cambia', async () => {
    const visto: number[] = [];
    const sub = observePendingCount().subscribe((n) => visto.push(n));
    // Primera emisión, con la cola vacía.
    await vi.waitFor(() => expect(visto.length).toBeGreaterThan(0));

    await op({ path: '/nueva' });
    await vi.waitFor(() => expect(visto.at(-1)).toBe(1));

    await drain(async () => undefined);
    await vi.waitFor(() => expect(visto.at(-1)).toBe(0));

    sub.unsubscribe();
  });

  /**
   * La razón de haber pasado a Dexie. El número de orden lo asigna la base con una clave
   * autoincremental, así que dos encolados a la vez —dos pestañas de la misma tablet— no
   * pueden recibir el mismo. Calculándolo en el cliente, leyendo el máximo y sumando uno,
   * ambos leían lo mismo y ambos escribían lo mismo: un empate, y con él un orden arbitrario
   * entre «crear la comanda» y «añadirle un ítem».
   */
  it('dos encolados simultáneos nunca comparten número de orden', async () => {
    const encoladas = await Promise.all(
      Array.from({ length: 20 }, (_, i) => op({ path: `/p${i}` })),
    );

    const seqs = encoladas.map((o) => o.seq);
    expect(new Set(seqs).size).toBe(20);
    // Y lo que devuelve `enqueue` es lo que quedó guardado, no una suposición.
    const guardadas = await list();
    expect(guardadas.map((o) => o.seq).sort((a, b) => a - b)).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('dos drenados simultáneos no envían nada dos veces', async () => {
    await op({ path: '/una' });
    const sent: string[] = [];
    const send = async (o: QueuedOperation) => {
      await new Promise((r) => setTimeout(r, 5));
      sent.push(o.path);
    };

    await Promise.all([drain(send), drain(send)]);

    expect(sent).toEqual(['/una']);
  });
});
