import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class RunDispositionDto {
  @IsUUID()
  readonly sppgId!: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  readonly date?: string;
}