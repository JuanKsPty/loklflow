import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { redact } from './audit-redact';
import type { AuditAction, AuditEntityType } from './audit-actions.constants';
import { AUDIT_MAX_LIMIT, QueryAuditLogsDto } from './dto/query-audit-logs.dto';

export interface CreateAuditLogInput {
  userId?: string;
  userName?: string;
  action: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Registra una acción. **Nunca lanza**: si la escritura falla, se loguea y se sigue.
   * Una bitácora caída no puede tumbar la operación de negocio que intentaba registrar.
   */
  async createLog(input: CreateAuditLogInput): Promise<void> {
    try {
      const log = this.repo.create({
        userId: input.userId ?? null,
        userName: input.userName ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        oldValue: redact(input.oldValue) ?? null,
        newValue: redact(input.newValue) ?? null,
        ipAddress: input.ipAddress ?? null,
      });
      await this.repo.save(log);
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la acción "${input.action}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findAll(query: QueryAuditLogsDto = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 50), AUDIT_MAX_LIMIT);

    const where: FindOptionsWhere<AuditLog> = {};
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.userId) where.userId = query.userId;

    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    if (from && to) where.createdAt = Between(from, to);
    else if (from) where.createdAt = MoreThanOrEqual(from);
    else if (to) where.createdAt = LessThanOrEqual(to);

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total, page, limit };
  }
}
