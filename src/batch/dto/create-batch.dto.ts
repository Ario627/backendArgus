import { IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { MOISTURE_PROXIES, WASTE_FLOWS, type MoistureProxy, type WasteFlow } from '../../common/constant/domain.constant.js';

const HEX64 = /^[0-9a-f]{64}$/;
const MAX_CLOCK_SKEW_MS = 300000;

export class CreateBatchDto {
  @IsOptional()
  @IsUUID('7')
  readonly id?: string;

  @IsUUID('7')
  readonly clientEventId!: string;

  @IsUUID()
  readonly sppgId!: string;

  @IsIn(WASTE_FLOWS)
  readonly aliran!: WasteFlow;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(500)
  readonly weightKg!: number;

  @IsISO8601()
  readonly occurredAt!: string;

  @IsOptional()
  @IsObject()
  readonly fractions?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  readonly visibleOil?: boolean;

  @IsOptional()
  @IsIn(MOISTURE_PROXIES)
  readonly moistureProxy?: MoistureProxy;

  @IsOptional()
  @IsString()
  @Length(64, 64)
  @Matches(HEX64)
  readonly photoHash?: string;

  @IsOptional()
  @IsInt()
  @Min(-MAX_CLOCK_SKEW_MS)
  @Max(MAX_CLOCK_SKEW_MS)
  readonly clockSkewMs?: number;
}