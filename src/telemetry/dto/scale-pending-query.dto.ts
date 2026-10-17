import { IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';

export class ScalePendingQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;
}