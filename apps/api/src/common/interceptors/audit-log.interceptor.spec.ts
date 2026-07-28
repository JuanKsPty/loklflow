import { firstValueFrom, of, throwError } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuditLogInterceptor, resolveIp } from './audit-log.interceptor';
import type { AuditService } from '../../audit/audit.service';
import type { AuditMeta } from '../decorators/audit.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

const user: JwtPayload = {
  sub: 'u1',
  name: 'Ana Gómez',
  email: 'ana@loklflow.com',
  roleId: 'r1',
  roleName: 'Administrador',
  permissions: [],
  loginMethod: 'email',
};

interface Ctx {
  user?: JwtPayload;
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
}

function setup(meta: AuditMeta | undefined, request: Ctx = {}, result: unknown = null) {
  const createLog = jest.fn(() => Promise.resolve());
  const audit = { createLog } as unknown as AuditService;
  const reflector = {
    getAllAndOverride: jest.fn(() => meta),
  } as unknown as Reflector;

  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const next: CallHandler = { handle: () => of(result) };

  return {
    interceptor: new AuditLogInterceptor(reflector, audit),
    context,
    next,
    createLog,
  };
}

describe('AuditLogInterceptor', () => {
  it('no audita cuando el handler no lleva @Audit()', async () => {
    const { interceptor, context, next, createLog } = setup(undefined);
    await firstValueFrom(interceptor.intercept(context, next));
    expect(createLog).not.toHaveBeenCalled();
  });

  it('registra la acción con el actor, el tipo de entidad y la IP', async () => {
    const { interceptor, context, next, createLog } = setup(
      { action: 'user.updated', entityType: 'user' },
      { user, params: { id: 'target-1' }, body: { name: 'Nuevo' }, ip: '10.0.0.5' },
    );

    await firstValueFrom(interceptor.intercept(context, next));

    expect(createLog).toHaveBeenCalledWith({
      userId: 'u1',
      userName: 'Ana Gómez',
      action: 'user.updated',
      entityType: 'user',
      entityId: 'target-1',
      newValue: { name: 'Nuevo' },
      ipAddress: '10.0.0.5',
    });
  });

  it('cae al email cuando el token no trae name (emitido antes del cambio)', async () => {
    const { name: _omitted, ...legacy } = user;
    const { interceptor, context, next, createLog } = setup(
      { action: 'auth.logout' },
      { user: legacy as JwtPayload },
    );

    await firstValueFrom(interceptor.intercept(context, next));
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({ userName: 'ana@loklflow.com' }),
    );
  });

  it('toma el id del resultado cuando la ruta no lo lleva (creaciones)', async () => {
    const { interceptor, context, next, createLog } = setup(
      { action: 'role.created', entityType: 'role' },
      { user, body: { name: 'Supervisor' } },
      { id: 'nuevo-rol', name: 'Supervisor' },
    );

    await firstValueFrom(interceptor.intercept(context, next));
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'nuevo-rol' }),
    );
  });

  it('el id de la ruta gana sobre el del resultado', async () => {
    const { interceptor, context, next, createLog } = setup(
      { action: 'role.updated' },
      { user, params: { id: 'de-la-ruta' } },
      { id: 'del-resultado' },
    );

    await firstValueFrom(interceptor.intercept(context, next));
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'de-la-ruta' }),
    );
  });

  it('deja entityId sin definir si no hay ninguna de las dos fuentes', async () => {
    const { interceptor, context, next, createLog } = setup({ action: 'auth.logout' }, { user });
    await firstValueFrom(interceptor.intercept(context, next));
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: undefined }),
    );
  });

  it('devuelve el resultado del handler sin alterarlo', async () => {
    const payload = { id: 'x', total: 42 };
    const { interceptor, context, next } = setup({ action: 'role.updated' }, { user }, payload);

    await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toBe(payload);
  });

  it('no rompe el request si la auditoría falla', async () => {
    const createLog = jest.fn(() => Promise.reject(new Error('bitácora caída')));
    const audit = { createLog } as unknown as AuditService;
    const reflector = {
      getAllAndOverride: jest.fn(() => ({ action: 'user.created' }) as AuditMeta),
    } as unknown as Reflector;
    const context = {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    const interceptor = new AuditLogInterceptor(reflector, audit);
    await expect(
      firstValueFrom(interceptor.intercept(context, { handle: () => of('ok') })),
    ).resolves.toBe('ok');
  });

  it('no audita cuando el handler lanza: no hubo cambio que registrar', async () => {
    const { interceptor, context, createLog } = setup({ action: 'role.deleted' }, { user });
    const next: CallHandler = {
      handle: () => throwError(() => new Error('rol de sistema')),
    };

    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toThrow(
      'rol de sistema',
    );
    expect(createLog).not.toHaveBeenCalled();
  });
});

describe('resolveIp', () => {
  it('prefiere request.ip', () => {
    expect(resolveIp({ ip: '1.2.3.4', socket: { remoteAddress: '5.6.7.8' } })).toBe('1.2.3.4');
  });

  it('cae al socket si no hay ip', () => {
    expect(resolveIp({ socket: { remoteAddress: '5.6.7.8' } })).toBe('5.6.7.8');
  });

  it('devuelve undefined si no hay ninguna', () => {
    expect(resolveIp({})).toBeUndefined();
  });
});
