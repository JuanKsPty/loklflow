import { ArgumentsHost, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { requestContext } from '../logging/request-context';

/**
 * Lo que este filtro tiene que hacer, y durante meses no hizo: **dejar constancia**. Al ser
 * `@Catch()` global desplaza al filtro base de Nest, que registraba toda excepción no
 * intrínseca; este se quedaba solo con el código y tiraba el objeto.
 *
 * La separación por severidad no es estética. `TestingLogger` silencia `log`, `warn`, `debug`
 * y `verbose` pero reenvía `error()`, así que registrar los 4xx como error llenaría de trazas
 * los 70 tests de integración —que provocan 401 y 400 a propósito— y las de verdad dejarían
 * de verse.
 */
describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let json: jest.Mock;
  let host: ArgumentsHost;
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as unknown as Response;
    const req = {
      url: '/api/orders',
      originalUrl: '/api/orders?open=true',
      method: 'GET',
    } as unknown as Request;
    host = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
    } as unknown as ArgumentsHost;

    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('registra un fallo inesperado como error, con la pila', () => {
    const boom = new Error('algo se rompió');
    filter.catch(boom, host);

    expect(error).toHaveBeenCalledTimes(1);
    const [entry, stack] = error.mock.calls[0] as [Record<string, unknown>, string];
    expect(entry).toMatchObject({ status: 500, method: 'GET', url: '/api/orders?open=true' });
    expect(stack).toBe(boom.stack);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });

  it('no registra los 4xx como error: un 401 va al nivel más bajo', () => {
    filter.catch(new UnauthorizedException(), host);

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('un 400 sí es aviso: alguien está mandando algo que no encaja', () => {
    filter.catch(new BadRequestException('falta el importe'), host);

    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  /**
   * El motivo por el que la excepción se describe campo a campo en lugar de volcarse entera.
   * `QueryFailedError` lleva los `parameters` enlazados, y en un alta de usuario eso es el
   * hash bcrypt del PIN yéndose a `docker logs`.
   */
  it('nunca escribe los parámetros enlazados de una consulta fallida', () => {
    const queryFailed = Object.assign(new Error('duplicate key value violates unique constraint'), {
      name: 'QueryFailedError',
      code: '23505',
      constraint: 'UQ_users_email',
      table: 'users',
      query: 'INSERT INTO "users"("email", "pin_hash") VALUES ($1, $2)',
      parameters: ['ana@loklflow.com', '$2b$10$estoEsElHashDelPin'],
    });

    filter.catch(queryFailed, host);

    const [entry] = error.mock.calls[0] as [Record<string, unknown>];
    const written = JSON.stringify(entry);
    expect(written).not.toContain('estoEsElHashDelPin');
    expect(written).not.toContain('ana@loklflow.com');
    // Y aun así queda lo que sirve para diagnosticar.
    expect(entry.error).toMatchObject({ code: '23505', constraint: 'UQ_users_email' });
  });

  it('omite el argumento de la pila cuando no hay ninguna, en vez de pasar undefined', () => {
    // ConsoleLogger no ignora un `undefined` en esa posición: lo imprime como un mensaje
    // más, así que saldría una segunda línea de log con la palabra «undefined».
    filter.catch('esto ni siquiera es un Error', host);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]).toHaveLength(1);
  });

  it('mete el id de la petición en el cuerpo, para poder dictarlo por teléfono', () => {
    requestContext.run({ requestId: 'abc12345' }, () => {
      filter.catch(new Error('x'), host);
    });

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'abc12345' }));
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'abc12345' }),
      expect.any(String),
    );
  });

  it('fuera de HTTP registra y no toca la respuesta, que ahí no existe', () => {
    const wsHost = { getType: () => 'ws' } as unknown as ArgumentsHost;

    expect(() => filter.catch(new Error('desde un socket'), wsHost)).not.toThrow();
    expect(error).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });
});
