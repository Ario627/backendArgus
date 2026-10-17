import { IsUUID } from 'class-validator';

export class LinkScaleDto {
  @IsUUID()
  readonly batchId!: string;
}