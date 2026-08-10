import type { DataSource } from 'typeorm';
import { AppService } from './app.service';

/**
 * `/api/ready`, sin base de datos.
 *
 * Se simula **un solo método** —`dataSource.query`— y no un repositorio entero: lo que se prueba
 * aquí es la caché, la deduplicación de sondas en vuelo y el corte por tiempo, que es lógica
 * propia del servicio y no del ORM. El camino con Postgres de verdad ya lo cubre el job `images`
 * de CI parando el contenedor, que es la única forma de comprobar el 503.
 */
describe('AppService', () => {
  const build = (query: jest.Mock) => ({
    service: new AppService({ query } as unknown as DataSource),
    query,
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('vivo no toca la base de datos', () => {
    const { service, query } = build(jest.fn());

    expect(service.health()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('listo consulta y responde ok', async () => {
    const { service, query } = build(jest.fn().mockResolvedValue([{ '?column?': 1 }]));

    await expect(service.ready()).resolves.toEqual({ ok: true });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('dentro de la ventana de caché no vuelve a consultar', async () => {
    const { service, query } = build(jest.fn().mockResolvedValue([]));

    await service.ready();
    jest.advanceTimersByTime(4_000);
    await service.ready();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('pasada la ventana, vuelve a consultar', async () => {
    const { service, query } = build(jest.fn().mockResolvedValue([]));

    await service.ready();
    jest.advanceTimersByTime(5_001);
    await service.ready();

    expect(query).toHaveBeenCalledTimes(2);
  });

  /**
   * La caché sola no protege de la ráfaga inicial: ninguna sonda habría terminado todavía, así
   * que veinte peticiones simultáneas serían veinte `SELECT 1` contra un pool de diez conexiones.
   */
  it('veinte peticiones a la vez producen una sola consulta', async () => {
    let resolve!: (value: unknown) => void;
    const query = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { service } = build(query);

    const all = Promise.all(Array.from({ length: 20 }, () => service.ready()));
    resolve([]);
    const results = await all;

    expect(query).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  describe('cuando la base no contesta', () => {
    it('devuelve el motivo', async () => {
      const { service } = build(jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

      await expect(service.ready()).resolves.toEqual({
        ok: false,
        error: 'connect ECONNREFUSED',
      });
    });

    it('un rechazo que no es un Error también se describe', async () => {
      const { service } = build(jest.fn().mockRejectedValue('se cayó'));

      await expect(service.ready()).resolves.toEqual({ ok: false, error: 'se cayó' });
    });

    it('una consulta que se queda colgada corta a los dos segundos', async () => {
      // Sin el corte, la sonda que existe para detectar que la base no responde es la última en
      // enterarse: se queda esperando hasta que el sistema operativo se rinde.
      const { service } = build(jest.fn().mockReturnValue(new Promise(() => undefined)));

      const promise = service.ready();
      jest.advanceTimersByTime(2_000);

      await expect(promise).resolves.toEqual({ ok: false, error: 'sin respuesta en 2000 ms' });
    });

    /** Un incidente de una hora no puede ser cientos de líneas idénticas en el log. */
    it('solo registra el fallo al cambiar de estado', async () => {
      const query = jest.fn().mockRejectedValue(new Error('caída'));
      const { service } = build(query);
      const error = jest
        .spyOn((service as unknown as { logger: { error: () => void } }).logger, 'error')
        .mockImplementation(() => undefined);

      await service.ready();
      jest.advanceTimersByTime(5_001);
      await service.ready();
      jest.advanceTimersByTime(5_001);
      await service.ready();

      expect(query).toHaveBeenCalledTimes(3);
      expect(error).toHaveBeenCalledTimes(1);
    });

    it('la recuperación sí deja una línea', async () => {
      const query = jest
        .fn()
        .mockRejectedValueOnce(new Error('caída'))
        .mockResolvedValue([]);
      const { service } = build(query);
      const logger = (service as unknown as { logger: { error: () => void; log: () => void } })
        .logger;
      jest.spyOn(logger, 'error').mockImplementation(() => undefined);
      const log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);

      await service.ready();
      jest.advanceTimersByTime(5_001);
      await expect(service.ready()).resolves.toEqual({ ok: true });

      expect(log).toHaveBeenCalledWith({ event: 'ready:recovered' });
    });
  });
});
