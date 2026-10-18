import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type {
  ApiErrorDetail,
  AuthenticatedUser,
  PaginatedItems,
} from '../common/types.js';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import { jakartaDateOf } from '../common/utils/daily-range.util.js';
import { generateId } from '../common/utils/id.util.js';
import { DistributionPoint } from '../database/entities/distribution-point.entity.js';
import { LeftoverObservation } from '../database/entities/leftover-observation.entity.js';
import { MenuItem } from '../database/entities/menu-item.entity.js';
import { MenuServing } from '../database/entities/menu-serving.entity.js';
import { sppgPointNotFoundError } from '../sppg/sppg.errors.js';
import type { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import type { CreateObservationDto } from './dto/create-observation.dto.js';
import type { CreateServingDto } from './dto/create-serving.dto.js';
import type { MenuInsightQueryDto } from './dto/insight-query.dto.js';
import type { MenuItemListQueryDto } from './dto/menu-list-query.dto.js';
import type { ServingListQueryDto } from './dto/serving-list-query.dto.js';
import {
  INSIGHT_METHOD_LINEAR,
  INSIGHT_SAMPLE_MIN,
  buildMenuInsights,
  type MenuInsightItem,
} from './insight.util.js';
import {
  menuDateInFutureError,
  menuItemInactiveError,
  menuItemNotFoundError,
  menuObsInvalidError,
  menuRangeInvalidError,
  menuServingNotFoundError,
  menuSppgRequiredError,
} from './menu.errors.js';
import {
  toMenuItemDto,
  toMenuServingDto,
  toMenuServingListDto,
  toObservationDto,
  type MenuItemDto,
  type MenuServingDto,
  type MenuServingListDto,
  type ObservationDto,
} from './menu.mapper.js';

const DEFAULT_INSIGHT_DAYS = 14;
const DAY_MS = 86400000;
interface InsightAggregateRow {
  readonly menu_item_id: string;
  readonly nama: string;
  readonly komponen: string;
  readonly biaya_rp: string | null;
  readonly avg_sisa: string;
  readonly n: string;
  readonly hari: string;
  readonly total_porsi: string;
  readonly porsi_terbuang: string;
}

interface IdRow {
  readonly id: string;
}

interface ServingRow {
  readonly id: string;
  readonly tanggal: string;
  readonly sppg_id: string;
  readonly menu_item_id: string;
  readonly titik_id: string | null;
}

export interface ObservationResult {
  readonly observation: ObservationDto;
  readonly duplicate: boolean;
}

export interface MenuInsightReport {
  readonly sppgId: string | null;
  readonly titikId: string | null;
  readonly from: string;
  readonly to: string;
  readonly metodeEstimasi: string;
  readonly sampleMin: number;
  readonly items: readonly MenuInsightItem[];
}

const shiftDate = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly itemRepository: Repository<MenuItem>,
    @InjectRepository(MenuServing)
    private readonly servingRepository: Repository<MenuServing>,
    @InjectRepository(LeftoverObservation)
    private readonly observationRepository: Repository<LeftoverObservation>,
    @InjectRepository(DistributionPoint)
    private readonly pointRepository: Repository<DistributionPoint>,
  ) {}

  async listItems(
    query: MenuItemListQueryDto,
  ): Promise<PaginatedItems<MenuItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.itemRepository.findAndCount({
      where: query.aktif === undefined ? {} : { aktif: query.aktif },
      order: { nama: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { items: rows.map(toMenuItemDto), nextCursor: null, total };
  }

  async createItem(dto: CreateMenuItemDto): Promise<MenuItemDto> {
    const item = this.itemRepository.create({
      id: generateId(),
      nama: dto.nama,
      komponen: dto.komponen,
      biayaRp: dto.biayaRp ?? null,
      aktif: true,
    });
    return toMenuItemDto(await this.itemRepository.save(item));
  }

  async listServings(
    query: ServingListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedItems<MenuServingListDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const sppgId = this.resolveServingScope(query.sppgId, actor);
    const [rows, total] = await this.servingRepository.findAndCount({
      where: {
        ...(query.tanggal === undefined ? {} : { tanggal: query.tanggal }),
        ...(sppgId === undefined ? {} : { sppgId }),
        ...(query.titikId === undefined ? {} : { titikId: query.titikId }),
      },
      order: { tanggal: 'DESC', id: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return {
      items: rows.map(toMenuServingListDto),
      nextCursor: null,
      total,
    };
  }

  async createServing(
    dto: CreateServingDto,
    actor: AuthenticatedUser,
  ): Promise<MenuServingDto> {
    const sppgId = this.resolveSppgScope(dto.sppgId, actor);
    this.assertNotFuture(dto.tanggal);
    await this.assertItemUsable(dto.menuItemId);
    if (dto.titikId !== undefined) {
      await this.assertPointOwned(sppgId, dto.titikId);
    }

    const inserted = await this.servingRepository.manager.query<IdRow[]>(
      `INSERT INTO menu_harian (id, tanggal, sppg_id, menu_item_id, titik_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tanggal, sppg_id, menu_item_id, titik_id) DO NOTHING
       RETURNING id`,
      [generateId(), dto.tanggal, sppgId, dto.menuItemId, dto.titikId ?? null],
    );

    const insertedId = inserted[0]?.id;
    const existing = await this.servingRepository.manager.query<ServingRow[]>(
      `SELECT id, tanggal, sppg_id, menu_item_id, titik_id
         FROM menu_harian
        WHERE tanggal = $1 AND sppg_id = $2 AND menu_item_id = $3
          AND titik_id IS NOT DISTINCT FROM $4`,
      [dto.tanggal, sppgId, dto.menuItemId, dto.titikId ?? null],
    );
    const row = existing[0];
    if (row === undefined) throw menuServingNotFoundError();

    return toMenuServingDto(
      {
        id: row.id,
        tanggal: row.tanggal,
        sppgId: row.sppg_id,
        menuItemId: row.menu_item_id,
        titikId: row.titik_id,
      },
      insertedId === undefined,
    );
  }

  async createObservation(
    dto: CreateObservationDto,
    actor: AuthenticatedUser,
  ): Promise<ObservationResult> {
    const sppgId = this.resolveSppgScope(dto.sppgId, actor);
    this.assertNotFuture(dto.tanggal);
    this.assertObservationValues(dto);
    await this.assertPointOwned(sppgId, dto.titikId);
    await this.assertItemUsable(dto.menuItemId);

    const inserted = await this.observationRepository.manager.query<IdRow[]>(
      `INSERT INTO observasi_sisa
         (id, tanggal, sppg_id, titik_id, menu_item_id, tingkat_sisa, jumlah_porsi_dinilai, dinilai_oleh, client_event_id, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (client_event_id) DO NOTHING
       RETURNING id`,
      [
        generateId(),
        dto.tanggal,
        sppgId,
        dto.titikId,
        dto.menuItemId,
        dto.tingkatSisa,
        dto.jumlahPorsiDinilai,
        actor.id,
        dto.clientEventId,
        false,
      ],
    );

    const insertedId = inserted[0]?.id;
    if (insertedId === undefined) {
      const raced = await this.observationRepository.findOne({
        where: { clientEventId: dto.clientEventId },
      });
      if (raced === null) throw new Error('MENU_OBS_DUPLIKAT_TIDAK_DITEMUKAN');
      return { observation: toObservationDto(raced), duplicate: true };
    }

    const observation = await this.observationRepository.findOneOrFail({
      where: { id: insertedId },
    });
    return { observation: toObservationDto(observation), duplicate: false };
  }

  async insights(
    query: MenuInsightQueryDto,
    actor: AuthenticatedUser,
  ): Promise<MenuInsightReport> {
    const scopeSppgId = this.resolveInsightScope(query, actor);
    const today = jakartaDateOf(new Date());
    const to = query.to ?? today;
    const from = query.from ?? shiftDate(to, -(DEFAULT_INSIGHT_DAYS - 1));
    if (from > to) throw menuRangeInvalidError();

    const rows = await this.observationRepository.manager.query<
      InsightAggregateRow[]
    >(
      `SELECT o.menu_item_id AS menu_item_id,
              i.nama AS nama,
              i.komponen AS komponen,
              i.biaya_rp AS biaya_rp,
              AVG(o.tingkat_sisa) AS avg_sisa,
              COUNT(*) AS n,
              COUNT(DISTINCT o.tanggal) AS hari,
              SUM(o.jumlah_porsi_dinilai) AS total_porsi,
              SUM((o.tingkat_sisa::numeric / 4) * o.jumlah_porsi_dinilai) AS porsi_terbuang
         FROM observasi_sisa o
         JOIN menu_item i ON i.id = o.menu_item_id
        WHERE o.tanggal >= $1 AND o.tanggal <= $2
          AND ($3::uuid IS NULL OR o.sppg_id = $3)
          AND ($4::uuid IS NULL OR o.titik_id = $4)
        GROUP BY o.menu_item_id, i.nama, i.komponen, i.biaya_rp`,
      [from, to, scopeSppgId, query.titikId ?? null],
    );

    const items = buildMenuInsights(
      rows.map((row) => ({
        menuItemId: row.menu_item_id,
        nama: row.nama,
        komponen: row.komponen as MenuInsightItem['komponen'],
        biayaRp: row.biaya_rp === null ? null : Number(row.biaya_rp),
        avgTingkatSisa: Number(row.avg_sisa),
        n: Number(row.n),
        hari: Number(row.hari),
        totalPorsiDinilai: Number(row.total_porsi),
        porsiTerbuangSetara: Number(row.porsi_terbuang),
      })),
    );

    return Object.freeze({
      sppgId: scopeSppgId,
      titikId: query.titikId ?? null,
      from,
      to,
      metodeEstimasi: INSIGHT_METHOD_LINEAR,
      sampleMin: INSIGHT_SAMPLE_MIN,
      items,
    });
  }

  private resolveSppgScope(
    sppgId: string | undefined,
    actor: AuthenticatedUser,
  ): string {
    if (actor.role === 'sppg_staff') {
      if (actor.sppgId === null) throw forbiddenActionError();
      if (sppgId !== undefined && sppgId !== actor.sppgId)
        throw forbiddenActionError();
      return actor.sppgId;
    }
    if (sppgId === undefined) throw menuSppgRequiredError();
    return sppgId;
  }

  private resolveInsightScope(
    query: MenuInsightQueryDto,
    actor: AuthenticatedUser,
  ): string | null {
    if (actor.role === 'sppg_staff') {
      if (actor.sppgId === null) throw forbiddenActionError();
      if (query.sppgId !== undefined && query.sppgId !== actor.sppgId)
        throw forbiddenActionError();
      return actor.sppgId;
    }
    return query.sppgId ?? null;
  }

  private resolveServingScope(
    sppgId: string | undefined,
    actor: AuthenticatedUser,
  ): string | undefined {
    if (actor.role === 'sppg_staff') {
      if (actor.sppgId === null) throw forbiddenActionError();
      if (sppgId !== undefined && sppgId !== actor.sppgId)
        throw forbiddenActionError();
      return actor.sppgId;
    }
    return sppgId;
  }

  private assertNotFuture(tanggal: string): void {
    if (tanggal > jakartaDateOf(new Date())) throw menuDateInFutureError();
  }

  private assertObservationValues(dto: CreateObservationDto): void {
    const details: ApiErrorDetail[] = [];
    if (
      dto.tingkatSisa < 0 ||
      dto.tingkatSisa > 4 ||
      !Number.isInteger(dto.tingkatSisa)
    ) {
      details.push({ code: 'scaleRange', field: 'tingkatSisa' });
    }
    if (
      !Number.isInteger(dto.jumlahPorsiDinilai) ||
      dto.jumlahPorsiDinilai <= 0
    ) {
      details.push({ code: 'portionsPositive', field: 'jumlahPorsiDinilai' });
    }
    if (details.length > 0) throw menuObsInvalidError(details);
  }

  private async assertItemUsable(menuItemId: string): Promise<void> {
    const item = await this.itemRepository.findOne({
      where: { id: menuItemId },
    });
    if (item === null) throw menuItemNotFoundError();
    if (!item.aktif) throw menuItemInactiveError();
  }

  private async assertPointOwned(
    sppgId: string,
    titikId: string,
  ): Promise<void> {
    const exists = await this.pointRepository.exists({
      where: { id: titikId, sppgId },
    });
    if (!exists) throw sppgPointNotFoundError();
  }
}
