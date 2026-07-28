import { Between, LessThanOrEqual, MoreThanOrEqual, type Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { REDACTED } from './audit-redact';
import { AUDIT_MAX_LIMIT } from './dto/query-audit-logs.dto';
import type { AuditLog } from './entities/audit-log.entity';

interface RepoMock {
  create: jest.Mock;
  save: jest.Mock;
  findAndCount: jest.Mock;
}

function makeService() {
  const repo: RepoMock = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    findAndCount: jest.fn(() => Promise.resolve([[], 0])),
  };
  const service = new AuditService(repo as unknown as Repository<AuditLog>);
  return { service, repo };
}

describe('AuditService.createLog', () => {
  it('persiste la acción con los campos ausentes en null', async () => {
    const { service, repo } = makeService();
    await service.createLog({ action: 'auth.login' });

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login',
        userId: null,
        entityId: null,
        oldValue: null,
        newValue: null,
        ipAddress: null,
      }),
    );
  });

  it('redacta las credenciales antes de persistir', async () => {
    const { service, repo } = makeService();
    await service.createLog({
      action: 'user.created',
      newValue: { name: 'Ana', password: 'texto-plano', pin: '1234' },
    });

    const saved = repo.create.mock.calls[0][0] as { newValue: Record<string, unknown> };
    expect(saved.newValue).toEqual({
      name: 'Ana',
      password: REDACTED,
      pin: REDACTED,
    });
  });

  it('NO propaga cuando la escritura falla: la operación de negocio debe sobrevivir', async () => {
    const { service, repo } = makeService();
    repo.save.mockRejectedValueOnce(new Error('relation "audit_logs" does not exist'));

    await expect(service.createLog({ action: 'role.deleted' })).resolves.toBeUndefined();
  });

  it('tampoco propaga si el fallo no es un Error', async () => {
    const { service, repo } = makeService();
    repo.save.mockRejectedValueOnce('caída de la conexión');

    await expect(service.createLog({ action: 'shift.closed' })).resolves.toBeUndefined();
  });
});

describe('AuditService.findAll', () => {
  const argsOf = (repo: RepoMock) =>
    repo.findAndCount.mock.calls[0][0] as {
      where: Record<string, unknown>;
      take: number;
      skip: number;
      order: Record<string, string>;
    };

  it('ordena por fecha descendente y pagina desde la primera página', async () => {
    const { service, repo } = makeService();
    await service.findAll();
    const args = argsOf(repo);

    expect(args.order).toEqual({ createdAt: 'DESC' });
    expect(args.take).toBe(50);
    expect(args.skip).toBe(0);
    expect(args.where).toEqual({});
  });

  it('calcula el offset a partir de la página', async () => {
    const { service, repo } = makeService();
    await service.findAll({ page: 3, limit: 20 });
    expect(argsOf(repo).skip).toBe(40);
  });

  it('recorta el limit al tope permitido', async () => {
    const { service, repo } = makeService();
    await service.findAll({ limit: 100000 });
    expect(argsOf(repo).take).toBe(AUDIT_MAX_LIMIT);
  });

  it('trata una página menor que 1 como la primera', async () => {
    const { service, repo } = makeService();
    await service.findAll({ page: 0 });
    expect(argsOf(repo).skip).toBe(0);
  });

  it('filtra por acción, usuario y tipo de entidad', async () => {
    const { service, repo } = makeService();
    await service.findAll({
      action: 'order.cancelled',
      userId: 'u1',
      entityType: 'order',
    });

    expect(argsOf(repo).where).toEqual({
      action: 'order.cancelled',
      userId: 'u1',
      entityType: 'order',
    });
  });

  it('usa Between cuando llegan las dos fechas', async () => {
    const { service, repo } = makeService();
    await service.findAll({ from: '2026-01-01T00:00:00Z', to: '2026-01-31T23:59:59Z' });

    expect(argsOf(repo).where).toEqual({
      createdAt: Between(
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-01-31T23:59:59Z'),
      ),
    });
  });

  it('usa MoreThanOrEqual con solo la fecha inicial', async () => {
    const { service, repo } = makeService();
    await service.findAll({ from: '2026-01-01T00:00:00Z' });

    expect(argsOf(repo).where).toEqual({
      createdAt: MoreThanOrEqual(new Date('2026-01-01T00:00:00Z')),
    });
  });

  it('usa LessThanOrEqual con solo la fecha final', async () => {
    const { service, repo } = makeService();
    await service.findAll({ to: '2026-01-31T00:00:00Z' });

    expect(argsOf(repo).where).toEqual({
      createdAt: LessThanOrEqual(new Date('2026-01-31T00:00:00Z')),
    });
  });

  it('devuelve el envelope paginado con los valores aplicados', async () => {
    const { service, repo } = makeService();
    const rows = [{ id: 'a' }] as AuditLog[];
    repo.findAndCount.mockResolvedValueOnce([rows, 137]);

    await expect(service.findAll({ page: 2, limit: 25 })).resolves.toEqual({
      data: rows,
      total: 137,
      page: 2,
      limit: 25,
    });
  });
});
