import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  DEVICE_TYPES,
  type DeviceType,
} from '../../common/constant/domain.constant.js';
import { trimToNull } from '../../common/dto/transforms.js';

export class CreateDeviceDto {
  @IsIn(DEVICE_TYPES)
  readonly tipe!: DeviceType;

  @IsOptional()
  @IsUUID()
  readonly fleetId?: string;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly firmware?: string | null;
}