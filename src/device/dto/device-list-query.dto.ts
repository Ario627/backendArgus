import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  DEVICE_TYPES,
  type DeviceType,
} from '../../common/constant/domain.constant.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import { parseOptionalBoolean } from '../../common/dto/transforms.js';

export class DeviceListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(DEVICE_TYPES)
  readonly tipe?: DeviceType;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @IsOptional()
  @IsUUID()
  readonly fleetId?: string;

  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  readonly revoked?: boolean;
}