import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { RealtimeGateway } from './realtime.gateway';

/**
 * El camino de rechazo del gateway era **mudo**: el `logger` estaba declarado y no aparecía en
 * ninguna línea, así que un token caducado, un secreto mal configurado y un cliente sin cookie
 * se veían exactamente igual desde fuera —la pantalla no se actualiza y no hay nada que mirar.
 */
describe('RealtimeGateway · conexiones rechazadas', () => {
  let warn: jest.SpyInstance;
  const config = { get: () => 'un-secreto' } as unknown as ConfigService;

  function socketWith(cookie?: string): Socket & { disconnect: jest.Mock } {
    return {
      handshake: { headers: cookie ? { cookie } : {}, address: '10.0.0.7' },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket & { disconnect: jest.Mock };
  }

  function gatewayThatThrows(name: string): RealtimeGateway {
    const jwt = {
      verify: () => {
        throw Object.assign(new Error('jwt expired'), { name });
      },
    } as unknown as JwtService;
    return new RealtimeGateway(jwt, config);
  }

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('registra el motivo y el origen cuando el token está caducado', () => {
    const socket = socketWith('access_token=loquesea');

    gatewayThatThrows('TokenExpiredError').handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ws:rejected', reason: 'token caducado', origin: '10.0.0.7' }),
    );
  });

  /**
   * La diferencia importa: un token caducado es el día a día de una tablet que lleva horas
   * encendida; uno inválido con el mismo secreto señala otra cosa (otro despliegue, otro
   * secreto, alguien probando).
   */
  it('distingue un token inválido de uno caducado', () => {
    gatewayThatThrows('JsonWebTokenError').handleConnection(socketWith('access_token=x'));

    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ reason: 'token inválido' }));
  });

  it('también deja constancia de una conexión sin token', () => {
    const jwt = { verify: jest.fn() } as unknown as JwtService;
    const socket = socketWith();

    new RealtimeGateway(jwt, config).handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ reason: 'sin token' }));
  });

  /**
   * Lo que de verdad protege el log: el cliente de Socket.io reintenta cada pocos segundos y
   * para siempre. Sin freno, una tablet olvidada encendida escribe la misma línea decenas de
   * miles de veces por noche.
   */
  it('no repite la misma línea en cada reintento del mismo cliente', () => {
    const gateway = gatewayThatThrows('TokenExpiredError');

    for (let i = 0; i < 50; i++) gateway.handleConnection(socketWith('access_token=x'));

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('pero un origen distinto sí se registra: no es un silencio global', () => {
    const gateway = gatewayThatThrows('TokenExpiredError');
    const otro = socketWith('access_token=x');
    (otro.handshake as { address: string }).address = '10.0.0.8';

    gateway.handleConnection(socketWith('access_token=x'));
    gateway.handleConnection(otro);

    expect(warn).toHaveBeenCalledTimes(2);
  });
});
