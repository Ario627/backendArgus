import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { trim } from '../../common/dto/transforms.js';

const TEXT_SAFE_PATTERN = /^[\P{Cc}\n\t]+$/u;

export class CloseAnomalyDto {
  @Transform(trim)
  @IsString()
  @Length(10, 400)
  @Matches(TEXT_SAFE_PATTERN)
  readonly catatan!: string;
}