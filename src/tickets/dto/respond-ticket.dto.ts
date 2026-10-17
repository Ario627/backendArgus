import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { trim } from '../../common/dto/transforms.js';
import { TEXT_SAFE_PATTERN } from './create-ticket.dto.js';

export class RespondTicketDto {
  @Transform(trim)
  @IsString()
  @Length(10, 600)
  @Matches(TEXT_SAFE_PATTERN)
  readonly jawaban!: string;
}