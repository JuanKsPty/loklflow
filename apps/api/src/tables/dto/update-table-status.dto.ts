import { IsIn } from 'class-validator';
import { TABLE_STATUSES, type TableStatus } from '../status.constants';

export class UpdateTableStatusDto {
  @IsIn(TABLE_STATUSES)
  status!: TableStatus;
}
