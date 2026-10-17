import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { trimToNull } from '../../common/dto/transforms.js';
import { TEXT_SAFE_PATTERN } from './create-ticket.dto.js';

export class TicketNoteDto {
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(400)
  @Matches(TEXT_SAFE_PATTERN)
  readonly catatan?: string | null;
}