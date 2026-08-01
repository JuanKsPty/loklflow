import { AppLogger, logLevelsFromEnv } from './app-logger';
import { requestContext } from './request-context';

describe('AppLogger', () => {
  let written: string[];

  beforeEach(() => {
    written = [];
    jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(((chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
  });

  afterEach(() => jest.restoreAllMocks());

  /**
   * El contrato que el CI comprueba sobre la imagen: **una línea, un JSON**. Depende de que
   * `colors` sea false y `compact` true —los valores por defecto cuando `json` está activo—,
   * porque solo entonces `ConsoleLogger` usa `JSON.stringify` en vez de `util.inspect`.
   */
  it('escribe una sola línea parseable por registro', () => {
    new AppLogger({ json: true }).log('turno abierto', 'Shifts');

    expect(written).toHaveLength(1);
    expect(written[0].trimEnd()).not.toContain('\n');
    expect(JSON.parse(written[0])).toMatchObject({
      level: 'log',
      message: 'turno abierto',
      context: 'Shifts',
    });
  });

  it('añade el id de la petición en curso', () => {
    const logger = new AppLogger({ json: true });

    requestContext.run({ requestId: 'req-123' }, () => logger.log('cobrando'));

    expect(JSON.parse(written[0]).requestId).toBe('req-123');
  });

  it('fuera de una petición no inventa el campo', () => {
    new AppLogger({ json: true }).log('arrancando');

    expect(JSON.parse(written[0])).not.toHaveProperty('requestId');
  });
});

describe('logLevelsFromEnv', () => {
  it('sin variable no apaga nada de lo que ya se veía', () => {
    expect(logLevelsFromEnv(undefined)).toEqual([
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('entiende el valor como mínimo, no como nivel único', () => {
    expect(logLevelsFromEnv('warn')).toEqual(['warn', 'error', 'fatal']);
  });

  it('ante un valor sin sentido no se queda mudo', () => {
    // Un typo en el .env no puede apagar el log entero: sería el peor momento para
    // descubrir que no hay registros.
    expect(logLevelsFromEnv('WARNING')).toHaveLength(6);
  });
});
