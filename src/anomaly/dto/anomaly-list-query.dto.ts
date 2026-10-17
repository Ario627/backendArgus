import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  ANOMALY_KINDS,
  ANOMALY_SEVERITIES,
  type AnomalyKind,
  type AnomalySeverity,
} from '../../common/constant/domain.constant.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import { parseOptionalBoolean } from '../../common/dto/transforms.js';

export class AnomalyListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(ANOMALY_KINDS)
  readonly jenis?: AnomalyKind;

  @IsOptional()
  @IsIn(ANOMALY_SEVERITIES)
  readonly tingkat?: AnomalySeverity;

  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  readonly terbuka?: boolean;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;
}