import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
  FLEET_STATUSES,
  type FleetStatus,
} from '../../common/constant/domain.constant.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import { parseOptionalBoolean } from '../../common/dto/transforms.js';

export class FleetListQueryDto extends ListQueryDto {
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  readonly aktif?: boolean;

  @IsOptional()
  @IsIn(FLEET_STATUSES)
  readonly status?: FleetStatus;
}