import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { parseOptionalBoolean } from '../../common/dto/transforms.js';

export class NarrativeQueryDto {
  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;

  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  readonly refresh?: boolean;
}