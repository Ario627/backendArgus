import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const LOOKBACK_MIN_DAYS = 7;
const LOOKBACK_MAX_DAYS = 365;

export class DigitScanDto {
  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number.parseInt(value, 10)
      : value,
  )
  @IsInt()
  @Min(LOOKBACK_MIN_DAYS)
  @Max(LOOKBACK_MAX_DAYS)
  readonly lookbackDays?: number;
}