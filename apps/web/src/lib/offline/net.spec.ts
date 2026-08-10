// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La sonda de conectividad.
 *
 * **jsdom por archivo, no por configuración.** `onBackOnline` se rinde con
 * `typeof window === 'undefined'`, así que en el entorno `node` del resto de `src/lib` no
 * haría nada y la mitad de este archivo probaría el vacío. Y el entorno no puede cambiarse
 * globalmente: `outbox.ts` ramifica según exista `navigator.locks`, que jsdom no trae, con lo
 * que los casos de la cola pasarían a probar la otra rama sin decirlo.
 *
 * `net.ts` lee `NEXT_PUBLIC_API_URL` **en ámbito de módulo**, así que cada caso que quiera
 * cambiar el entorno tiene que pasar por `vi.resetModules()` y un import dinámico. Importarlo
 * arriba una sola vez congelaría la URL del primer caso y los demás probarían otra cosa.
 */

const load = async () => import('./net');

function setOnLine(value: boolean | undefined) {
  // `undefined` simula el servidor, donde no hay `navigator` en absoluto.
  vi.stubGlobal('navigator', value === undefined ? undefined : { onLine: value });
}

describe('conectividad', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('isProbablyOnline', () => {
    // La trampa clásica: `navigator.onLine` da true en cuanto hay una interfaz activa, así que
    // con el router encendido y sin línea —el caso que este proyecto existe para sobrevivir—
    // afirma que hay conexión mientras ninguna petición llega. Solo su `false` es información.
    it('solo cree al navegador cuando dice que NO', async () => {
      const { isProbablyOnline } = await load();

      setOnLine(false);
      expect(isProbablyOnline()).toBe(false);

      setOnLine(true);
      expect(isProbablyOnline()).toBe(true);
    });

    it('en el servidor, donde no hay navigator, asume que sí', async () => {
      const { isProbablyOnline } = await load();
      setOnLine(undefined);

      expect(isProbablyOnline()).toBe(true);
    });
  });

  describe('probe', () => {
    it('no gasta una petición si el navegador ya dijo que no hay red', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      setOnLine(false);
      const { probe } = await load();

      expect(await probe()).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    /**
     * Fija la decisión documentada: la sonda va a `/health`, que a propósito **no** toca la
     * base de datos. Con `/ready` una base caída se leería como «no hay red» y la cola dejaría
     * de enviar cuando el camino hasta el servidor está perfectamente bien.
     */
    it('pregunta a /api/health y no a /api/ready', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);
      setOnLine(true);
      const { probe } = await load();

      await probe();

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toMatch(/\/api\/health$/);
      expect(url).not.toMatch(/ready/);
      expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
    });

    it('usa NEXT_PUBLIC_API_URL cuando está definida', async () => {
      vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://loklflow.juank.tech');
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);
      setOnLine(true);
      const { probe } = await load();

      await probe();

      expect(fetchSpy.mock.calls[0][0]).toBe('https://loklflow.juank.tech/api/health');
    });

    it('es cierto con un 200 y falso con un 500', async () => {
      setOnLine(true);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const online = await load();
      expect(await online.probe()).toBe(true);

      vi.resetModules();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const down = await load();
      expect(await down.probe()).toBe(false);
    });

    it('un rechazo del fetch es «no hay servidor», no una excepción', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      setOnLine(true);
      const { probe } = await load();

      await expect(probe()).resolves.toBe(false);
    });

    /**
     * Sin el corte, una red que acepta la conexión y no contesta deja la sonda colgada, y con
     * ella el drenado de la cola: el peor caso es el que parece que funciona.
     */
    it('corta a los 4 segundos y no se queda colgada', async () => {
      vi.useFakeTimers();
      let abortado = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init: { signal: AbortSignal }) =>
            new Promise((_resolve, reject) => {
              init.signal.addEventListener('abort', () => {
                abortado = true;
                reject(new Error('aborted'));
              });
            }),
        ),
      );
      setOnLine(true);
      const { probe } = await load();

      const result = probe();
      await vi.advanceTimersByTimeAsync(4_000);

      expect(abortado).toBe(true);
      await expect(result).resolves.toBe(false);
    });
  });

  describe('onBackOnline', () => {
    it('avisa cuando el evento online llega y el servidor contesta', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      setOnLine(true);
      const { onBackOnline } = await load();
      const back = vi.fn();

      const stop = onBackOnline(back, 60_000);
      window.dispatchEvent(new Event('online'));
      await vi.waitFor(() => expect(back).toHaveBeenCalled());

      stop();
    });

    /**
     * El intervalo no es redundante con el evento: cuando el WiFi nunca se cayó y lo que se
     * cortó fue la línea de arriba, `online` no se emite jamás y el evento solo no bastaría.
     */
    it('también avisa por el intervalo, sin ningún evento', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      setOnLine(true);
      const { onBackOnline } = await load();
      const back = vi.fn();

      const stop = onBackOnline(back, 30_000);
      await vi.advanceTimersByTimeAsync(30_000);

      expect(back).toHaveBeenCalledTimes(1);
      stop();
    });

    it('no avisa mientras el servidor sigue sin contestar', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      setOnLine(true);
      const { onBackOnline } = await load();
      const back = vi.fn();

      const stop = onBackOnline(back, 10_000);
      await vi.advanceTimersByTimeAsync(30_000);

      expect(back).not.toHaveBeenCalled();
      stop();
    });

    it('no solapa sondas: con una en vuelo, el siguiente disparo no lanza otra', async () => {
      vi.useFakeTimers();
      let pendientes = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          pendientes += 1;
          return new Promise(() => undefined);
        }),
      );
      setOnLine(true);
      const { onBackOnline } = await load();

      const stop = onBackOnline(vi.fn(), 1_000);
      await vi.advanceTimersByTimeAsync(5_000);

      expect(pendientes).toBe(1);
      stop();
    });

    it('al desuscribirse deja de escuchar y de sondear', async () => {
      vi.useFakeTimers();
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchSpy);
      setOnLine(true);
      const { onBackOnline } = await load();
      const back = vi.fn();

      const stop = onBackOnline(back, 1_000);
      stop();
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(10_000);

      expect(back).not.toHaveBeenCalled();
    });
  });
});
