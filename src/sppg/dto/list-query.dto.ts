import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import { parseOptionalBoolean } from '../../common/dto/transforms.js';

export class SppgListQueryDto extends ListQueryDto {
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  readonly aktif?: boolean;
}
