import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere } from 'typeorm';
import type { TicketStatus } from '../common/constant/domain.constant.js';
import { TICKET_TRANSITIONS } from '../common/constant/transitions.constant.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import { generateId } from '../common/utils/id.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { Ticket } from '../database/entities/ticket.entity.js';
import { TicketEvent } from '../database/entities/ticket-event.entity.js';
import {
  ticketNotFoundError,
  ticketTransitionInvalidError,
} from './ticket.errors.js';
import {
  toTicketDetailDto,
  toTicketDto,
  type TicketDetailDto,
  type TicketDto,
} from './ticket.mapper.js';
import type { RespondTicketDto } from './dto/respond-ticket.dto.js';
import type { TicketListQueryDto } from './dto/ticket-list-query.dto.js';
import type { TicketNoteDto } from './dto/ticket-note.dto.js';
import type { VerifyTicketDto } from './dto/verify-ticket.dto.js';

const MODERATION_NOTE_MIN = 10;

const VERIFY_SQL = `
WITH updated AS (
  UPDATE tiket_warga
     SET status = $2
   WHERE id = $1
     AND status = 'BARU'
  RETURNING id
)
SELECT id FROM updated`;

const RESPOND_SQL = `
WITH updated AS (
  UPDATE tiket_warga
     SET status = 'DITANGGAPI',
         jawaban_sppg = $2,
         jawaban_at = now()
   WHERE id = $1
     AND status = 'DIVERIFIKASI'
  RETURNING id
)
SELECT id FROM updated`;

const CLOSE_SQL = `
WITH updated AS (
  UPDATE tiket_warga
     SET status = 'SELESAI'
   WHERE id = $1
     AND status = 'DITANGGAPI'
  RETURNING id
)
SELECT id FROM updated`;

interface IdRow {
  readonly id: string;
}

@Injectable()
export class TicketService {
  private readonly demoMode: boolean;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketEvent)
    private readonly eventRepository: Repository<TicketEvent>,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.demoMode = config.demoMode;
  }

  private assertStaffScope(ticket: Ticket, actor: AuthenticatedUser): void {
    if (actor.role !== 'sppg_staff') return;
    if (actor.sppgId === null || actor.sppgId !== ticket.sppgId) {
      throw forbiddenActionError();
    }
  }

  private async requireTicket(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (ticket === null) throw ticketNotFoundError();
    return ticket;
  }

  private async applyTransition(
    id: string,
    sql: string,
    params: readonly unknown[],
    from: TicketStatus,
    to: TicketStatus,
    actorId: string,
    catatan: string | null,
  ): Promise<void> {
    await this.ticketRepository.manager.transaction(async (manager) => {
      const updated = await manager.query<IdRow[]>(sql, [id, ...params]);
      if (updated.length === 0) {
        throw ticketTransitionInvalidError([
          { code: 'statusSaatIni', field: `${from} -> ${to}` },
        ]);
      }
      await manager.query(
        `INSERT INTO tiket_event (id, tiket_id, dari_status, ke_status, aktor, catatan)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [generateId(), id, from, to, actorId, catatan],
      );
    });
  }

  private assertTransition(from: TicketStatus, to: TicketStatus): void {
    if (!TICKET_TRANSITIONS[from].includes(to)) {
      throw ticketTransitionInvalidError([
        { code: 'transisiTidakDiizinkan', field: `${from} -> ${to}` },
      ]);
    }
  }

  async list(
    query: TicketListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedItems<TicketDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: FindOptionsWhere<Ticket> = {};
    if (!this.demoMode) where.isDemo = false;
    if (query.status !== undefined) where.status = query.status;
    if (query.jenis !== undefined) where.jenis = query.jenis;
    if (actor.role === 'sppg_staff') {
      if (actor.sppgId === null) throw forbiddenActionError();
      where.sppgId = actor.sppgId;
    } else if (query.sppgId !== undefined) {
      where.sppgId = query.sppgId;
    }
    const [rows, total] = await this.ticketRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { items: rows.map(toTicketDto), nextCursor: null, total };
  }

  async getDetail(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    const ticket = await this.requireTicket(id);
    this.assertStaffScope(ticket, actor);
    const riwayat = await this.eventRepository.find({
      where: { tiketId: id },
      order: { ts: 'ASC', id: 'ASC' },
    });
    return toTicketDetailDto(ticket, riwayat);
  }

  async verify(
    id: string,
    dto: VerifyTicketDto,
    actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    const ticket = await this.requireTicket(id);
    const catatan = dto.catatan ?? null;
    if (dto.status === 'DITOLAK_MODERASI') {
      if (catatan === null || catatan.length < MODERATION_NOTE_MIN) {
        throw ticketTransitionInvalidError([
          { code: 'noteRequired', field: 'catatan' },
        ]);
      }
    }
    this.assertTransition(ticket.status, dto.status);
    await this.applyTransition(
      id,
      VERIFY_SQL,
      [dto.status],
      ticket.status,
      dto.status,
      actor.id,
      catatan,
    );
    return this.getDetail(id, actor);
  }

  async respond(
    id: string,
    dto: RespondTicketDto,
    actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    const ticket = await this.requireTicket(id);
    this.assertStaffScope(ticket, actor);
    this.assertTransition(ticket.status, 'DITANGGAPI');
    await this.applyTransition(
      id,
      RESPOND_SQL,
      [dto.jawaban],
      ticket.status,
      'DITANGGAPI',
      actor.id,
      dto.jawaban,
    );
    return this.getDetail(id, actor);
  }

  async close(
    id: string,
    dto: TicketNoteDto,
    actor: AuthenticatedUser,
  ): Promise<TicketDetailDto> {
    const ticket = await this.requireTicket(id);
    this.assertTransition(ticket.status, 'SELESAI');
    await this.applyTransition(
      id,
      CLOSE_SQL,
      [],
      ticket.status,
      'SELESAI',
      actor.id,
      dto.catatan ?? null,
    );
    return this.getDetail(id, actor);
  }
}
