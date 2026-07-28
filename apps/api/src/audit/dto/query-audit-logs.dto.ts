import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from '../audit-actions.constants';

/** Tope duro de página: sin él, `?limit=100000` haría un volcado completo de la tabla. */
export const AUDIT_MAX_LIMIT = 200;

export class QueryAuditLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_MAX_LIMIT)
  limit?: number = 50;

  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: AuditEntityType;

  @IsOptional()
  @IsString()
  userId?: string;

  /** Inicio del rango, inclusive. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Fin del rango, inclusive. */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
