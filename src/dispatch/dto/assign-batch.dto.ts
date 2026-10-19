import { IsUUID } from 'class-validator';

export class AssignBatchDto {
  @IsUUID()
  readonly batchId!: string;

  @IsUUID()
  readonly fleetId!: string;
}
