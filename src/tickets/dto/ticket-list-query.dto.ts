import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  TICKET_KINDS,
  TICKET_STATUSES,
  type TicketKind,
  type TicketStatus,
} from '../../common/constant/domain.constant.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';

export class TicketListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  readonly status?: TicketStatus;

  @IsOptional()
  @IsIn(TICKET_KINDS)
  readonly jenis?: TicketKind;

  @IsOptional()
  @IsUUID()
  readonly sppgId?: string;
}