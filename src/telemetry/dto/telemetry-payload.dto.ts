import { HardwareStatus } from 'src/common/constant/operational-status.constant';
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class TelemetryPayloadDto {
  @IsString()
  @IsNotEmpty()
  readonly fleetId!: string;

  @IsNumber()
  @IsLatitude()
  readonly latitude!: number;

  @IsNumber()
  @IsLongitude()
  readonly longitude!: number;

  @IsNumber()
  @Min(0)
  readonly speedKmh!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  readonly volumePercent!: number;

  @IsEnum(HardwareStatus)
  readonly hardwareStatus!: HardwareStatus;

  @IsDateString()
  readonly deviceTimestamp!: string;
}