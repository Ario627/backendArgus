import { IsOptional, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import { trim } from '../../common/dto/transforms.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ServingListQueryDto extends ListQueryDto {
  @IsOptional()
  @Transform(trim)
  @Matches(DATE_PATTERN)
  readonly tanggal?: string;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @IsOptional()
  @IsUUID()
  readonly titikId?: string;
}
