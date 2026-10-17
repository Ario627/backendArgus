import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  HARDWARE_STATUSES,
  type HardwareStatus,
} from '../../common/constant/domain.constant.js';

const TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/;

export class TrackerTelemetryDto {
  @IsUUID()
  readonly fleetId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  readonly latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  readonly longitude!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(200)
  readonly speedKmh?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  readonly volumePercent?: number | null;

  @IsIn(HARDWARE_STATUSES)
  readonly hardwareStatus!: HardwareStatus;

  @IsISO8601()
  @Matches(TIMEZONE_SUFFIX)
  readonly deviceTimestamp!: string;
}