import { IsOptional, IsUUID } from 'class-validator';

export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;
}