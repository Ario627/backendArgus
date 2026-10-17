import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AppConfiguration } from '../config/configuration.js';
import {
  jakartaDateOf,
  wibDayRangeUtc,
} from '../common/utils/daily-range.util.js';
import { generateId } from '../common/utils/id.util.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { Ticket } from '../database/entities/ticket.entity.js';
import { hitungSkorRisikoTiket } from './ticket-risk.util.js';
import { hashIpPelapor } from './ticket-ip.util.js';
import {
  sppgPublicNotFoundError,
  ticketFotoUnknownError,
  ticketRateLimitedError,
} from './ticket.errors.js';
import {
  SPPG_SLUG_PATTERN,
  type CreateTicketDto,
} from './dto/create-ticket.dto.js';
import {
  toPublicSppgDto,
  toPublicTicketCreatedDto,
  type PublicSppgDto,
  type PublicTicketCreatedDto,
} from './ticket.mapper.js';

const RISK_WINDOW_HOURS = 72;
const IP_WINDOW_HOURS = 1;

const ANOMALI_COUNT_SQL = `
SELECT count(*)::int AS "total"
  FROM anomali a
  JOIN batch b ON b.id = a.batch_id
 WHERE b.sppg_id = $1
   AND a.dibuka_at >= now() - make_interval(hours => $2)`;

const TERSANGKUT_COUNT_SQL = `
SELECT count(*)::int AS "total"
  FROM batch
 WHERE sppg_id = $1
   AND status = 'TERSANGKUT'
   AND created_at >= now() - make_interval(hours => $2)`;

const TICKET_IP_COUNT_SQL = `
SELECT count(*)::int AS "total"
  FROM tiket_warga
 WHERE ip_hash = $1
   AND created_at >= now() - make_interval(hours => $2)`;

const TICKET_SPPG_COUNT_SQL = `
SELECT count(*)::int AS "total"
  FROM tiket_warga
 WHERE sppg_id = $1
   AND created_at >= $2`;

const INSERT_TICKET_SQL = `
INSERT INTO tiket_warga
  (id, sppg_id, jenis, deskripsi, foto_hash, lat, lng, status, skor_risiko, ip_hash, client_event_id, is_demo, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'BARU', $8, $9, $10, $11, now())
ON CONFLICT (client_event_id) DO NOTHING
RETURNING id`;

const BIND_FOTO_SQL = `
WITH bound AS (
  UPDATE foto
     SET ref_id = $2
   WHERE sha256 = $1
     AND ref_tipe = 'tiket'
     AND ref_id IS NULL
  RETURNING sha256
)
SELECT sha256 FROM bound`;

interface CountRow {
  readonly total: number;
}

interface IdRow {
  readonly id: string;
}

export interface PublicTicketResult {
  readonly ticket: PublicTicketCreatedDto;
  readonly duplicate: boolean;
}

@Injectable()
export class PublicTicketService {
  private readonly logger = new Logger(PublicTicketService.name);
  private readonly ipHashSalt: string;
  private readonly perHour: number;
  private readonly perDayPerSppg: number;

  constructor(
    configService: ConfigService,
    @InjectRepository(Sppg)
    private readonly sppgRepository: Repository<Sppg>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.ipHashSalt = config.auth.ipHashSalt;
    this.perHour = config.throttle.ticketPerHour;
    this.perDayPerSppg = config.throttle.ticketPerDayPerSppg;
  }

  private async countOf(
    sql: string,
    params: readonly unknown[],
  ): Promise<number> {
    const rows = await this.ticketRepository.manager.query<CountRow[]>(
      sql,
      params,
    );
    return rows[0]?.total ?? 0;
  }

  private async resolveSppg(slug: string): Promise<Sppg> {
    if (!SPPG_SLUG_PATTERN.test(slug)) throw sppgPublicNotFoundError();
    const sppg = await this.sppgRepository.findOne({
      where: { publicSlug: slug },
    });
    if (sppg === null || !sppg.aktif) throw sppgPublicNotFoundError();
    return sppg;
  }

  private async assertRateLimits(
    sppgId: string,
    ipHash: string,
  ): Promise<void> {
    const perIp = await this.countOf(TICKET_IP_COUNT_SQL, [
      ipHash,
      IP_WINDOW_HOURS,
    ]);
    if (perIp >= this.perHour) throw ticketRateLimitedError('IP');
    const dayStart = wibDayRangeUtc(jakartaDateOf(new Date())).start;
    const perSppg = await this.countOf(TICKET_SPPG_COUNT_SQL, [
      sppgId,
      dayStart,
    ]);
    if (perSppg >= this.perDayPerSppg) throw ticketRateLimitedError('SPPG');
  }

  private async assertFotoExists(fotoHash: string): Promise<void> {
    const rows = await this.ticketRepository.manager.query<
      { sha256: string }[]
    >(`SELECT sha256 FROM foto WHERE sha256 = $1`, [fotoHash]);
    if (rows.length === 0) throw ticketFotoUnknownError();
  }

  private async riskScoreFor(
    sppgId: string,
    dto: CreateTicketDto,
  ): Promise<{ skor: number; catatan: string }> {
    const anomali72h = await this.countOf(ANOMALI_COUNT_SQL, [
      sppgId,
      RISK_WINDOW_HOURS,
    ]);
    const tersangkut72h = await this.countOf(TERSANGKUT_COUNT_SQL, [
      sppgId,
      RISK_WINDOW_HOURS,
    ]);
    const result = hitungSkorRisikoTiket({
      jenis: dto.jenis,
      anomali72h,
      tersangkut72h,
      berfoto: dto.fotoHash !== undefined,
    });
    return {
      skor: result.skor,
      catatan: JSON.stringify({
        ...result.komponen,
        anomali72h,
        tersangkut72h,
      }),
    };
  }

  private async findByClientEventId(
    clientEventId: string,
  ): Promise<Ticket | null> {
    return this.ticketRepository.findOne({ where: { clientEventId } });
  }

  async getPublicSppg(slug: string): Promise<PublicSppgDto> {
    const sppg = await this.resolveSppg(slug);
    return toPublicSppgDto({ nama: sppg.nama, alamat: sppg.alamat });
  }

  async createTicket(
    dto: CreateTicketDto,
    ip: string,
  ): Promise<PublicTicketResult> {
    const existing = await this.findByClientEventId(dto.clientEventId);
    if (existing !== null) {
      return {
        ticket: toPublicTicketCreatedDto(existing),
        duplicate: true,
      };
    }

    const sppg = await this.resolveSppg(dto.sppgPublicId);
    const now = new Date();
    const ipHash = hashIpPelapor(ip, this.ipHashSalt, now);
    await this.assertRateLimits(sppg.id, ipHash);
    if (dto.fotoHash !== undefined) {
      await this.assertFotoExists(dto.fotoHash);
    }
    const risk = await this.riskScoreFor(sppg.id, dto);

    const ticketId = generateId();
    const inserted = await this.ticketRepository.manager.transaction(
      async (manager) => {
        const rows = await manager.query<IdRow[]>(INSERT_TICKET_SQL, [
          ticketId,
          sppg.id,
          dto.jenis,
          dto.deskripsi,
          dto.fotoHash ?? null,
          dto.lat ?? null,
          dto.lng ?? null,
          risk.skor,
          ipHash,
          dto.clientEventId,
          sppg.isDemo,
        ]);
        const insertedId = rows[0]?.id;
        if (insertedId === undefined) {
          const raced = await manager.findOne(Ticket, {
            where: { clientEventId: dto.clientEventId },
          });
          if (raced === null) {
            throw sppgPublicNotFoundError();
          }
          return { id: raced.id, duplicate: true };
        }
        await manager.query(
          `INSERT INTO tiket_event (id, tiket_id, dari_status, ke_status, aktor, catatan)
           VALUES ($1, $2, NULL, 'BARU', NULL, $3)`,
          [generateId(), insertedId, risk.catatan],
        );
        if (dto.fotoHash !== undefined) {
          const bound = await manager.query<{ sha256: string }[]>(
            BIND_FOTO_SQL,
            [dto.fotoHash, insertedId],
          );
          if (bound.length === 0) {
            this.logger.warn(
              `foto tiket ${dto.fotoHash.slice(0, 12)} sudah terikat tiket lain`,
            );
          }
        }
        return { id: insertedId, duplicate: false };
      },
    );

    const ticket = await this.ticketRepository.findOneOrFail({
      where: { id: inserted.id },
    });
    this.logger.log(
      `tiket baru id=${ticket.id} sppg=${sppg.id} jenis=${ticket.jenis} skor=${risk.skor} duplikat=${inserted.duplicate}`,
    );
    return {
      ticket: toPublicTicketCreatedDto(ticket),
      duplicate: inserted.duplicate,
    };
  }
}