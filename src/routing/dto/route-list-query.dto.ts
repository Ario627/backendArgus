import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ROUTE_STATUSES,
  type RouteStatus,
} from  '../../common/constant/domain.constant.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import { trim } from '../../common/dto/transforms.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class RouteListQueryDto extends ListQueryDto {
  @IsOptional()
  @Transform(trim)
  @Matches(DATE_PATTERN)
  readonly tanggal?: string;

  @IsOptional()
  @IsIn(ROUTE_STATUSES)
  readonly status?: RouteStatus;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;
}