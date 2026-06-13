import { IsIn } from 'class-validator';
import { TABLE_STATUSES, type TableStatus } from '@loklflow/types';

export class UpdateTableStatusDto {
  @IsIn(TABLE_STATUSES)
  status!: TableStatus;
}
